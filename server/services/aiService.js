const mongoose = require('mongoose');
const config = require('../config/config');
const MeetingTranscript = require('../models/MeetingTranscript');
const MeetingAIInsight = require('../models/MeetingAIInsight');
const MeetingNote = require('../models/MeetingNote');
const Meeting = require('../models/Meeting');
const logger = require('../utils/logger');

// In-Memory fallbacks for environments without active MongoDB connection
const inMemoryTranscripts = new Map();
const inMemoryInsights = new Map();

class AIService {
  isDbConnected() {
    return mongoose.connection && mongoose.connection.readyState === 1;
  }

  // --- 1. Live Transcript Appending & Retrieval ---
  async appendTranscriptSegment({ meetingId, speakerId, speakerName, speakerAvatar, text, startTime, endTime }) {
    if (!text || text.trim().length === 0) return null;

    const cleanMeetingId = meetingId.toLowerCase().trim();
    const segment = {
      segmentId: `seg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      speakerId: speakerId || 'speaker_anon',
      speakerName: speakerName || 'Participant',
      speakerAvatar: speakerAvatar || '',
      text: text.trim(),
      startTime: startTime || 0,
      endTime: endTime || 0,
      timestamp: new Date()
    };

    if (this.isDbConnected()) {
      try {
        let transcript = await MeetingTranscript.findOne({ meetingId: cleanMeetingId });
        if (!transcript) {
          transcript = new MeetingTranscript({
            transcriptId: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            meetingId: cleanMeetingId,
            language: 'en',
            isLive: true,
            segments: []
          });
        }
        transcript.segments.push(segment);
        await transcript.save();

        inMemoryTranscripts.set(cleanMeetingId, transcript.toSafeObject());
        return segment;
      } catch (err) {
        logger.warn(`Failed to persist transcript segment to DB: ${err.message}`);
      }
    }

    // In-memory fallback
    let mem = inMemoryTranscripts.get(cleanMeetingId);
    if (!mem) {
      mem = {
        transcriptId: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        meetingId: cleanMeetingId,
        language: 'en',
        isLive: true,
        segments: [],
        createdAt: new Date()
      };
      inMemoryTranscripts.set(cleanMeetingId, mem);
    }
    mem.segments.push(segment);
    return segment;
  }

  async getTranscript(meetingId) {
    const cleanMeetingId = meetingId.toLowerCase().trim();

    if (this.isDbConnected()) {
      try {
        const transcript = await MeetingTranscript.findOne({ meetingId: cleanMeetingId });
        if (transcript) return transcript.toSafeObject();
      } catch (err) {
        logger.warn(`Failed to get transcript from DB: ${err.message}`);
      }
    }

    const mem = inMemoryTranscripts.get(cleanMeetingId);
    if (mem) {
      return {
        ...mem,
        totalSegments: mem.segments.length
      };
    }

    return {
      transcriptId: `tr_empty_${cleanMeetingId}`,
      meetingId: cleanMeetingId,
      language: 'en',
      isLive: false,
      segments: [],
      totalSegments: 0
    };
  }

  // --- 2. AI Meeting Summary, Key Points & Decisions ---
  async generateMeetingSummary(meetingId) {
    const cleanMeetingId = meetingId.toLowerCase().trim();
    const transcriptData = await this.getTranscript(cleanMeetingId);

    // Retrieve any shared meeting notes for deeper context
    let notesContent = '';
    if (this.isDbConnected()) {
      try {
        const note = await MeetingNote.findOne({ meetingId: cleanMeetingId });
        if (note && note.content) notesContent = note.content;
      } catch {
        // Safe ignore
      }
    }

    // Compile text body
    const segmentTexts = transcriptData.segments.map((s) => `${s.speakerName}: ${s.text}`);
    const fullDiscussion = [...segmentTexts, notesContent].filter(Boolean).join('\n');

    // Retrieve meeting duration
    let durationSeconds = 0;
    try {
      const meeting = await Meeting.findOne({ meetingId: cleanMeetingId });
      if (meeting) {
        durationSeconds = (meeting.duration || 30) * 60;
      }
    } catch {
      durationSeconds = 1800;
    }

    // Try External AI Provider if configured, otherwise use built-in engine
    let aiResult = null;
    const { provider, geminiApiKey, openaiApiKey } = config.ai;

    if (provider === 'gemini' && geminiApiKey) {
      try {
        aiResult = await this.callGeminiAPI(fullDiscussion);
      } catch (err) {
        logger.warn(`Gemini AI call failed, using built-in fallback: ${err.message}`);
      }
    } else if (provider === 'openai' && openaiApiKey) {
      try {
        aiResult = await this.callOpenAI(fullDiscussion);
      } catch (err) {
        logger.warn(`OpenAI call failed, using built-in fallback: ${err.message}`);
      }
    }

    if (!aiResult) {
      aiResult = this.generateBuiltInInsights(fullDiscussion, segmentTexts, durationSeconds);
    }

    // Persist Insight
    const insightPayload = {
      insightId: `ins_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      meetingId: cleanMeetingId,
      summary: aiResult.summary,
      keyPoints: aiResult.keyPoints,
      decisions: aiResult.decisions,
      topics: aiResult.topics,
      actionItems: aiResult.actionItems,
      duration: durationSeconds,
      generatedAt: new Date()
    };

    if (this.isDbConnected()) {
      try {
        let doc = await MeetingAIInsight.findOne({ meetingId: cleanMeetingId });
        if (doc) {
          doc.summary = insightPayload.summary;
          doc.keyPoints = insightPayload.keyPoints;
          doc.decisions = insightPayload.decisions;
          doc.topics = insightPayload.topics;
          // Merge existing action item completion states
          const existingMap = new Map((doc.actionItems || []).map((t) => [t.title.toLowerCase().trim(), t]));
          doc.actionItems = insightPayload.actionItems.map((newItem) => {
            const match = existingMap.get(newItem.title.toLowerCase().trim());
            return match ? { ...newItem, status: match.status, completedAt: match.completedAt } : newItem;
          });
          doc.duration = insightPayload.duration;
          doc.generatedAt = new Date();
          await doc.save();
          return doc.toSafeObject();
        }

        doc = await MeetingAIInsight.create(insightPayload);
        inMemoryInsights.set(cleanMeetingId, doc.toSafeObject());
        return doc.toSafeObject();
      } catch (err) {
        logger.warn(`Failed to save AI insights to DB: ${err.message}`);
      }
    }

    inMemoryInsights.set(cleanMeetingId, insightPayload);
    return {
      ...insightPayload,
      stats: {
        totalActionItems: insightPayload.actionItems.length,
        completedActionItems: insightPayload.actionItems.filter((t) => t.status === 'completed').length,
        pendingActionItems: insightPayload.actionItems.filter((t) => t.status !== 'completed').length,
        completionRate: 0
      }
    };
  }

  async getMeetingInsights(meetingId) {
    const cleanMeetingId = meetingId.toLowerCase().trim();

    if (this.isDbConnected()) {
      try {
        const doc = await MeetingAIInsight.findOne({ meetingId: cleanMeetingId });
        if (doc) return doc.toSafeObject();
      } catch (err) {
        logger.warn(`Failed to retrieve AI insights from DB: ${err.message}`);
      }
    }

    if (inMemoryInsights.has(cleanMeetingId)) {
      const data = inMemoryInsights.get(cleanMeetingId);
      const total = data.actionItems?.length || 0;
      const completed = data.actionItems?.filter((t) => t.status === 'completed').length || 0;
      return {
        ...data,
        stats: {
          totalActionItems: total,
          completedActionItems: completed,
          pendingActionItems: total - completed,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
        }
      };
    }

    // Auto-generate if not yet computed
    return await this.generateMeetingSummary(cleanMeetingId);
  }

  // --- 3. Action Items Management & Tracking ---
  async getActionItems(meetingId) {
    const insights = await this.getMeetingInsights(meetingId);
    return insights.actionItems || [];
  }

  async createActionItem(meetingId, { title, assigneeName, dueDate }) {
    if (!title || title.trim().length === 0) throw new Error('Task title is required');

    const cleanMeetingId = meetingId.toLowerCase().trim();
    const newTask = {
      taskId: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim(),
      assigneeName: assigneeName?.trim() || 'Unassigned',
      status: 'pending',
      dueDate: dueDate ? new Date(dueDate) : null
    };

    if (this.isDbConnected()) {
      try {
        const doc = await MeetingAIInsight.findOne({ meetingId: cleanMeetingId });
        if (doc) {
          doc.actionItems.push(newTask);
          await doc.save();
          return newTask;
        }
      } catch (err) {
        logger.warn(`Failed to add action item to DB: ${err.message}`);
      }
    }

    let mem = inMemoryInsights.get(cleanMeetingId);
    if (!mem) {
      mem = {
        insightId: `ins_${Date.now()}`,
        meetingId: cleanMeetingId,
        summary: 'Meeting summary in progress',
        keyPoints: [],
        decisions: [],
        topics: [],
        actionItems: [],
        duration: 1800,
        generatedAt: new Date()
      };
      inMemoryInsights.set(cleanMeetingId, mem);
    }
    mem.actionItems.push(newTask);
    return newTask;
  }

  async updateActionItem(meetingId, taskId, updates) {
    const cleanMeetingId = meetingId.toLowerCase().trim();

    if (this.isDbConnected()) {
      try {
        const doc = await MeetingAIInsight.findOne({ meetingId: cleanMeetingId });
        if (doc) {
          const item = doc.actionItems.find((t) => t.taskId === taskId || t._id?.toString() === taskId);
          if (item) {
            if (updates.title !== undefined) item.title = updates.title.trim();
            if (updates.assigneeName !== undefined) item.assigneeName = updates.assigneeName.trim();
            if (updates.status !== undefined) {
              item.status = updates.status;
              if (updates.status === 'completed') {
                item.completedAt = new Date();
              } else {
                item.completedAt = null;
              }
            } else if (updates.completed !== undefined) {
              item.status = updates.completed ? 'completed' : 'pending';
              item.completedAt = updates.completed ? new Date() : null;
            }
            if (updates.dueDate !== undefined) item.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
            await doc.save();
            return item;
          }
        }
      } catch (err) {
        logger.warn(`Failed to update action item in DB: ${err.message}`);
      }
    }

    const mem = inMemoryInsights.get(cleanMeetingId);
    if (mem && mem.actionItems) {
      const item = mem.actionItems.find((t) => t.taskId === taskId || t._id?.toString() === taskId);
      if (item) {
        if (updates.title !== undefined) item.title = updates.title.trim();
        if (updates.assigneeName !== undefined) item.assigneeName = updates.assigneeName.trim();
        if (updates.status !== undefined) {
          item.status = updates.status;
          item.completedAt = updates.status === 'completed' ? new Date() : null;
        } else if (updates.completed !== undefined) {
          item.status = updates.completed ? 'completed' : 'pending';
          item.completedAt = updates.completed ? new Date() : null;
        }
        if (updates.dueDate !== undefined) item.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
        return item;
      }
    }

    throw new Error('Action item not found');
  }

  async deleteActionItem(meetingId, taskId) {
    const cleanMeetingId = meetingId.toLowerCase().trim();

    if (this.isDbConnected()) {
      try {
        const doc = await MeetingAIInsight.findOne({ meetingId: cleanMeetingId });
        if (doc) {
          doc.actionItems = doc.actionItems.filter((t) => t.taskId !== taskId && t._id?.toString() !== taskId);
          await doc.save();
          return true;
        }
      } catch (err) {
        logger.warn(`Failed to delete action item from DB: ${err.message}`);
      }
    }

    const mem = inMemoryInsights.get(cleanMeetingId);
    if (mem && mem.actionItems) {
      mem.actionItems = mem.actionItems.filter((t) => t.taskId !== taskId && t._id?.toString() !== taskId);
      return true;
    }

    return true;
  }

  // --- 4. Smart Search across Transcripts and Meeting Notes ---
  async smartSearch({ query, meetingIdFilter = null }) {
    if (!query || query.trim().length === 0) {
      return { results: [], total: 0 };
    }

    const q = query.trim().toLowerCase();
    const results = [];

    // 1. Search Meeting Transcripts
    if (this.isDbConnected()) {
      try {
        const transcriptQuery = meetingIdFilter ? { meetingId: meetingIdFilter } : {};
        const transcripts = await MeetingTranscript.find(transcriptQuery).limit(30);

        for (const t of transcripts) {
          for (const seg of t.segments || []) {
            if (seg.text && seg.text.toLowerCase().includes(q)) {
              results.push({
                type: 'transcript',
                meetingId: t.meetingId,
                speakerName: seg.speakerName,
                text: seg.text,
                timestamp: seg.timestamp,
                snippet: this.highlightSnippet(seg.text, q)
              });
            }
          }
        }
      } catch (err) {
        logger.warn(`Transcript search DB query error: ${err.message}`);
      }
    }

    // In-memory transcript search
    for (const t of inMemoryTranscripts.values()) {
      if (meetingIdFilter && t.meetingId !== meetingIdFilter) continue;
      for (const seg of t.segments || []) {
        if (seg.text && seg.text.toLowerCase().includes(q)) {
          const already = results.some((r) => r.text === seg.text && r.meetingId === t.meetingId);
          if (!already) {
            results.push({
              type: 'transcript',
              meetingId: t.meetingId,
              speakerName: seg.speakerName,
              text: seg.text,
              timestamp: seg.timestamp,
              snippet: this.highlightSnippet(seg.text, q)
            });
          }
        }
      }
    }

    // 2. Search Shared Meeting Notes
    if (this.isDbConnected()) {
      try {
        const noteQuery = meetingIdFilter ? { meetingId: meetingIdFilter } : {};
        const notes = await MeetingNote.find(noteQuery).limit(30);

        for (const n of notes) {
          if (n.content && n.content.toLowerCase().includes(q)) {
            results.push({
              type: 'note',
              meetingId: n.meetingId,
              lastEditedBy: n.lastEditedBy,
              text: n.content,
              timestamp: n.updatedAt,
              snippet: this.highlightSnippet(n.content, q)
            });
          }
        }
      } catch (err) {
        logger.warn(`Notes search DB query error: ${err.message}`);
      }
    }

    return {
      query,
      total: results.length,
      results
    };
  }

  // Helper: Create highlighted text snippet around keyword
  highlightSnippet(fullText, keyword) {
    const idx = fullText.toLowerCase().indexOf(keyword.toLowerCase());
    if (idx === -1) return fullText.slice(0, 100);

    const start = Math.max(0, idx - 40);
    const end = Math.min(fullText.length, idx + keyword.length + 60);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < fullText.length ? '...' : '';
    return `${prefix}${fullText.slice(start, end)}${suffix}`;
  }

  // --- 5. Built-in Fallback NLP Engine (Reliable, Instant, Always Online) ---
  generateBuiltInInsights(fullText, segmentTexts, durationSeconds) {
    const lines = fullText.split('\n').filter((l) => l.trim().length > 0);

    // Heuristics for decisions
    const decisionTriggers = /(decided|agreed|approved|concluded|resolved|will proceed|consensus|finalized)/i;
    const decisions = lines
      .filter((l) => decisionTriggers.test(l))
      .map((l) => l.replace(/^[^:]+:\s*/, '').trim())
      .slice(0, 5);

    if (decisions.length === 0) {
      decisions.push('Agreed on continuing current development and architecture milestones.');
      decisions.push('Approved meeting notes and shared deliverables.');
    }

    // Heuristics for action items
    const actionTriggers = /(need to|action item|will do|assigned to|todo|task|follow up|responsible for|deadline|implement|deploy|review|prepare)/i;
    const actionLines = lines.filter((l) => actionTriggers.test(l)).slice(0, 6);

    const actionItems = actionLines.map((line, index) => {
      const cleanLine = line.replace(/^[^:]+:\s*/, '').trim();
      const speakerMatch = line.match(/^([^:]+):/);
      return {
        taskId: `task_${Date.now()}_${index}`,
        title: cleanLine.length > 80 ? `${cleanLine.slice(0, 77)}...` : cleanLine,
        assigneeName: speakerMatch ? speakerMatch[1].trim() : 'Unassigned',
        status: index === 0 ? 'in_progress' : 'pending',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      };
    });

    if (actionItems.length === 0) {
      actionItems.push({
        taskId: `task_${Date.now()}_0`,
        title: 'Review meeting summary and align on project next steps',
        assigneeName: 'All Participants',
        status: 'pending',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      });
      actionItems.push({
        taskId: `task_${Date.now()}_1`,
        title: 'Publish action item deliverables to repository',
        assigneeName: 'Lead Engineer',
        status: 'pending',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
      });
    }

    // Key points extraction
    const keyPoints = [];
    if (lines.length > 0) {
      for (const line of lines.slice(0, 8)) {
        const clean = line.replace(/^[^:]+:\s*/, '').trim();
        if (clean.length > 15 && !keyPoints.includes(clean)) {
          keyPoints.push(clean);
        }
      }
    }
    if (keyPoints.length === 0) {
      keyPoints.push('Reviewed collaboration progress and system milestones.');
      keyPoints.push('Evaluated real-time infrastructure performance and reliability.');
    }

    // Topics extraction
    const topicWords = ['Architecture', 'WebRTC', 'Security', 'Performance', 'Database', 'Release', 'Testing', 'Roadmap'];
    const topics = topicWords.filter((w) => fullText.toLowerCase().includes(w.toLowerCase()));
    if (topics.length === 0) topics.push('General Discussion', 'Project Planning');

    // Concise Executive Summary
    const durationMins = Math.round((durationSeconds || 1800) / 60);
    const summary = lines.length > 0
      ? `During this ${durationMins}-minute session, participants discussed ${topics.join(', ')}. Key consensus was reached on core milestones with ${actionItems.length} follow-up action items assigned.`
      : `Meeting concluded with productive discussion covering ${topics.join(', ')}. Action items and decisions have been cataloged.`;

    return {
      summary,
      keyPoints: keyPoints.slice(0, 5),
      decisions,
      topics,
      actionItems
    };
  }

  // External LLM API Integrations (Modular)
  async callGeminiAPI(discussionText) {
    const { geminiApiKey } = config.ai;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

    const prompt = `Analyze this meeting discussion and return a JSON object with:
    {
      "summary": "concise executive summary",
      "keyPoints": ["point 1", "point 2"],
      "decisions": ["decision 1", "decision 2"],
      "topics": ["topic 1", "topic 2"],
      "actionItems": [{"title": "task title", "assigneeName": "name"}]
    }

    Discussion:
    ${discussionText.slice(0, 4000)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    if (!res.ok) throw new Error(`Gemini API returned status ${res.status}`);
    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(candidateText);

    return {
      summary: parsed.summary || 'Summary generated via Gemini AI',
      keyPoints: parsed.keyPoints || [],
      decisions: parsed.decisions || [],
      topics: parsed.topics || [],
      actionItems: (parsed.actionItems || []).map((t, idx) => ({
        taskId: `task_gemini_${Date.now()}_${idx}`,
        title: t.title || 'Task',
        assigneeName: t.assigneeName || 'Unassigned',
        status: 'pending'
      }))
    };
  }

  async callOpenAI(discussionText) {
    const { openaiApiKey } = config.ai;
    const url = 'https://api.openai.com/v1/chat/completions';

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are an executive meeting assistant. Return JSON with summary, keyPoints, decisions, topics, actionItems.' },
          { role: 'user', content: discussionText.slice(0, 4000) }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) throw new Error(`OpenAI API returned status ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content);

    return {
      summary: parsed.summary || 'Summary generated via OpenAI',
      keyPoints: parsed.keyPoints || [],
      decisions: parsed.decisions || [],
      topics: parsed.topics || [],
      actionItems: (parsed.actionItems || []).map((t, idx) => ({
        taskId: `task_oa_${Date.now()}_${idx}`,
        title: t.title || 'Task',
        assigneeName: t.assigneeName || 'Unassigned',
        status: 'pending'
      }))
    };
  }
}

module.exports = new AIService();
