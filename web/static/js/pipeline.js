const Pipeline = (() => {
  let eventSource = null;
  let currentRunId = null;

  function start(runId, agents) {
    currentRunId = runId;
    _buildStepper(agents);
    _showPipelineSection();
    _connectSSE(runId);
  }

  function _showPipelineSection() {
    const section = document.getElementById("pipelineSection");
    if (section) section.style.display = "block";
  }

  function _buildStepper(agents) {
    const stepper = document.getElementById("pipelineStepper");
    if (!stepper) return;

    const labels = {
      "question-framing": "Framing Question",
      "hypothesis": "Generating Hypotheses",
      "data-explorer": "Exploring Data",
      "descriptive-analytics": "Analyzing Patterns",
      "overtime-trend": "Analyzing Trends",
      "cohort-analysis": "Analyzing Cohorts",
      "root-cause-investigator": "Investigating Root Cause",
      "cross-verification": "Cross-Verifying",
      "validation": "Validating Findings",
      "opportunity-sizer": "Sizing Opportunity",
      "story-architect": "Designing Storyboard",
      "narrative-coherence-reviewer": "Reviewing Narrative",
      "chart-maker": "Creating Charts",
      "visual-design-critic": "Reviewing Design",
      "storytelling": "Writing Narrative",
      "deck-creator": "Building Deck",
      "comms-drafter": "Drafting Comms",
    };

    stepper.innerHTML = agents
      .map(
        (a) => `
      <div class="stepper-step" data-agent="${a}" id="step-${a}">
        <div class="stepper-dot"></div>
        <div class="stepper-info">
          <span class="stepper-label">${labels[a] || a}</span>
          <span class="stepper-time" id="time-${a}"></span>
        </div>
      </div>
    `
      )
      .join("");
  }

  function _connectSSE(runId) {
    if (eventSource) {
      eventSource.close();
    }

    eventSource = new EventSource(`/api/pipeline/${runId}/events`);

    eventSource.addEventListener("pipeline_start", (e) => {
      const data = JSON.parse(e.data);
      Dashboard.addCard({
        type: "text",
        title: "Pipeline Started",
        content: `Running **${data.plan.replace(/_/g, " ")}** plan with ${data.agents.length} agents.\n\n> ${data.question}`,
      });
    });

    eventSource.addEventListener("phase_start", (e) => {
      const data = JSON.parse(e.data);
      const step = document.getElementById(`step-${data.agent}`);
      if (step) {
        step.classList.add("active");
        step.classList.remove("pending");
      }
    });

    eventSource.addEventListener("phase_complete", (e) => {
      const data = JSON.parse(e.data);
      const step = document.getElementById(`step-${data.agent}`);
      if (step) {
        step.classList.remove("active");
        step.classList.add("complete");
      }
      const timeEl = document.getElementById(`time-${data.agent}`);
      if (timeEl) {
        timeEl.textContent = `${data.elapsed}s`;
      }
    });

    eventSource.addEventListener("finding", (e) => {
      const data = JSON.parse(e.data);
      const badge =
        data.confidence === "high"
          ? "high-conf"
          : data.confidence === "low"
          ? "low-conf"
          : "med-conf";
      Dashboard.addCard({
        type: "finding",
        label: `Finding — ${data.agent}`,
        title: data.headline,
        body: `<div class="finding-card">
          <div class="finding-badge ${badge}">${data.confidence}</div>
          <p>${_escapeHtml(data.evidence)}</p>
          <div class="finding-agent">from ${data.agent}</div>
        </div>`,
      });
    });

    eventSource.addEventListener("chart", (e) => {
      const data = JSON.parse(e.data);
      Dashboard.addCard({
        type: "chart",
        title: `Chart from ${data.agent}`,
        filename: data.filename,
      });
    });

    eventSource.addEventListener("pipeline_complete", (e) => {
      const data = JSON.parse(e.data);
      Dashboard.addCard({
        type: "text",
        title: "Analysis Complete",
        content:
          `Pipeline finished in **${data.elapsed}s**.\n\n` +
          `- **${data.findings_count}** findings\n` +
          `- **${data.charts_count}** charts\n` +
          `- **${data.agents_completed}** agents completed`,
      });
      _close();
    });

    eventSource.addEventListener("pipeline_error", (e) => {
      const data = JSON.parse(e.data);
      Dashboard.addCard({
        type: "error",
        title: `Pipeline Error in ${data.agent}`,
        content: data.error,
      });
      _close();
    });

    eventSource.onerror = () => {
      _close();
    };
  }

  function _close() {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  function _escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  return { start };
})();
