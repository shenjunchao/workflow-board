      const APP_DATA_KEY = "minimalWorkflowBoard.appData";
      const APP_OWNER_KEY = "minimalWorkflowBoard.appOwner";
      const LEGACY_STORAGE_KEY = "minimalWorkflowBoard.v2";
      const GEMINI_API_KEY_STORAGE_KEY = "minimalWorkflowBoard.geminiApiKey";
      const GEMINI_API_CONFIG_STORAGE_KEY = "minimalWorkflowBoard.geminiApiConfig";
      const DEFAULT_GEMINI_API_CONFIG = {
        apiKey: "",
        endpoint: "https://generativelanguage.googleapis.com/v1beta",
        modelId: "gemini-2.5-flash-preview-09-2025",
      };
      const NODE_WIDTH = 184;
      const NODE_HEIGHT = 70;
      const GRID_SIZE = 120;
      const MIN_ZOOM = 0.35;
      const MAX_ZOOM = 2;
      const SUPABASE_TABLE = "user_app_data";
      const CLOUD_SAVE_DEBOUNCE_MS = 700;

      /* =========================================================================
         Gemini API 配置与请求方法 (智能 AI 核心)
         ========================================================================= */
      function getGeminiApiConfig() {
        let saved = null;
        try {
          saved = JSON.parse(localStorage.getItem(GEMINI_API_CONFIG_STORAGE_KEY));
        } catch (error) {
          saved = null;
        }

        const legacyApiKey = (localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || "").trim();
        return {
          apiKey: (saved?.apiKey || legacyApiKey || DEFAULT_GEMINI_API_CONFIG.apiKey).trim(),
          endpoint: (saved?.endpoint || DEFAULT_GEMINI_API_CONFIG.endpoint).trim(),
          modelId: (saved?.modelId || DEFAULT_GEMINI_API_CONFIG.modelId).trim(),
        };
      }

      function setGeminiApiConfig(config) {
        const next = {
          apiKey: (config.apiKey || "").trim(),
          endpoint: (config.endpoint || DEFAULT_GEMINI_API_CONFIG.endpoint).trim(),
          modelId: (config.modelId || DEFAULT_GEMINI_API_CONFIG.modelId).trim(),
        };

        if (next.apiKey && next.endpoint && next.modelId) {
          localStorage.setItem(GEMINI_API_CONFIG_STORAGE_KEY, JSON.stringify(next));
          localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
        } else {
          localStorage.removeItem(GEMINI_API_CONFIG_STORAGE_KEY);
          localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
        }
        renderApiConfigState();
      }

      function hasGeminiApiConfig() {
        const config = getGeminiApiConfig();
        return Boolean(config.apiKey && config.endpoint && config.modelId);
      }

      function renderApiConfigState() {
        const btn = document.querySelector("#apiConfigBtn");
        if (!btn) return;
        const ready = hasGeminiApiConfig();
        btn.textContent = ready ? "API 已配置" : "配置 API";
        btn.classList.toggle("api-ready", ready);
        btn.title = ready ? "已配置 API Key、请求地址与模型 ID，点击可重新配置" : "配置 API Key、请求地址与模型 ID 后才能使用 AI 功能";
      }

      function configureGeminiApiKey(afterSave = null) {
        const current = getGeminiApiConfig();
        const modal = document.getElementById('confirmModal');
        const title = document.getElementById('confirmTitle');
        const message = document.getElementById('confirmMessage');
        const legacyInput = document.getElementById('confirmInput');
        const cancelBtn = document.getElementById('confirmCancelBtn');
        const okBtn = document.getElementById('confirmOkBtn');

        title.textContent = "配置 AI API";
        message.innerHTML = `
          <span class="api-config-note">配置会保存在当前浏览器本地。请求地址可填写基础地址，也可填写包含 {modelId} 和 {apiKey} 的完整地址。</span>
          <label class="api-config-field">API Key
            <input id="apiConfigKeyInput" type="password" autocomplete="off" value="${escapeHtml(current.apiKey)}" placeholder="请输入 API Key" />
          </label>
          <label class="api-config-field">请求地址
            <input id="apiConfigEndpointInput" type="url" value="${escapeHtml(current.endpoint)}" placeholder="https://generativelanguage.googleapis.com/v1beta" />
          </label>
          <label class="api-config-field">模型 ID
            <input id="apiConfigModelInput" type="text" value="${escapeHtml(current.modelId)}" placeholder="gemini-2.5-flash-preview-09-2025" />
          </label>
        `;
        legacyInput.style.display = 'none';
        cancelBtn.style.display = 'block';
        modal.style.display = 'flex';

        const keyInput = document.getElementById('apiConfigKeyInput');
        const endpointInput = document.getElementById('apiConfigEndpointInput');
        const modelInput = document.getElementById('apiConfigModelInput');
        keyInput.focus();

        const cleanup = () => {
          modal.style.display = 'none';
          message.textContent = "";
          okBtn.onclick = null;
          cancelBtn.onclick = null;
        };

        okBtn.onclick = () => {
          const config = {
            apiKey: keyInput.value,
            endpoint: endpointInput.value,
            modelId: modelInput.value,
          };
          if (!config.apiKey.trim() || !config.endpoint.trim() || !config.modelId.trim()) {
            customAlert("请完整填写 API Key、请求地址和模型 ID。");
            return;
          }
          cleanup();
          setGeminiApiConfig(config);
          customAlert("API 配置已保存，可以使用 AI 功能了。");
          if (typeof afterSave === "function") afterSave();
        };
        cancelBtn.onclick = cleanup;
      }

      function buildGeminiRequestUrl(config) {
        const endpoint = config.endpoint.replace(/\/+$/, "");
        if (endpoint.includes("{modelId}") || endpoint.includes("{apiKey}")) {
          return endpoint
            .replaceAll("{modelId}", encodeURIComponent(config.modelId))
            .replaceAll("{apiKey}", encodeURIComponent(config.apiKey));
        }

        const separator = endpoint.includes("?") ? "&" : "?";
        if (endpoint.includes(":generateContent")) {
          return `${endpoint}${separator}key=${encodeURIComponent(config.apiKey)}`;
        }

        return `${endpoint}/models/${encodeURIComponent(config.modelId)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
      }
      
      function showLoading(msg) {
        document.getElementById('loadingMessage').textContent = msg || "加载中...";
        document.getElementById('loadingModal').style.display = 'flex';
      }
      
      function hideLoading() {
        document.getElementById('loadingModal').style.display = 'none';
      }

      async function callGeminiAPI(prompt, systemInstruction = null, jsonSchema = null) {
        const apiConfig = getGeminiApiConfig();
        if (!hasGeminiApiConfig()) {
          customAlert("请先完整配置 API Key、请求地址和模型 ID。");
          return null;
        }
        const url = buildGeminiRequestUrl(apiConfig);
        const payload = {
          contents: [{ parts: [{ text: prompt }] }]
        };
        if (systemInstruction) {
          payload.systemInstruction = { parts: [{ text: systemInstruction }] };
        }
        if (jsonSchema) {
          payload.generationConfig = {
            responseMimeType: "application/json",
            responseSchema: jsonSchema
          };
        }

        const delays = [1000, 2000, 4000, 8000, 16000];
        
        for (let i = 0; i < 5; i++) {
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error("API 返回的数据为空");
            
            return jsonSchema ? JSON.parse(text) : text;
          } catch (err) {
            if (i === 4) {
              customAlert("AI 服务暂时不可用，请稍后再试。");
              console.error(err);
              return null;
            }
            await new Promise(r => setTimeout(r, delays[i]));
          }
        }
      }

      // 触发 AI 生成整个工作流
      async function generateAIWorkflow(topic) {
        if (!hasGeminiApiConfig()) {
          configureGeminiApiKey(() => generateAIWorkflow(topic));
          return;
        }
        showLoading("✨ 正在召唤AI规划流程，请稍候...");
        
        const schema = {
          type: "OBJECT",
          properties: {
            nodes: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "STRING" },
                  title: { type: "STRING" },
                  description: { type: "STRING" },
                  category: { type: "STRING" }
                }
              }
            },
            edges: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  source: { type: "STRING" },
                  target: { type: "STRING" }
                }
              }
            }
          }
        };

        const sys = "你是一个专业的工作流规划专家。请将任务拆解为逻辑连贯的步骤。生成5到10个关键节点。每个节点需要明确的名称(title)、执行说明(description)和合理的阶段分类(category)。通过 edges 数组构建节点的先后执行顺序，必须是一个有向无环图。";
        const prompt = `请为主题“${topic}”生成一份标准的工作流程图。`;
        
        const result = await callGeminiAPI(prompt, sys, schema);
        hideLoading();
        
        if (result && result.nodes && result.edges) {
          const newId = `ws-${Date.now().toString(36)}`;
          
          const newNodes = result.nodes.map((n) => ({
            id: n.id,
            title: n.title || "未命名",
            description: n.description || "",
            category: n.category || "默认分组",
            status: "waiting",
            x: 0,
            y: 0,
            width: null,
            height: null,
            color: "#ffffff",
            linkUrl: "",
            linkText: "",
            imageData: ""
          }));
          
          const newEdges = result.edges.map((e) => ({
            id: `edge-${Date.now().toString(36)}-${Math.random().toString(36).substring(2,5)}`,
            source: e.source,
            target: e.target
          }));
          
          appData.data[newId] = {
            workflowTitle: topic,
            projectCategory: "AI 生成项目",
            updatedAt: Date.now(),
            selectedNodeId: newNodes[0] ? newNodes[0].id : null,
            selectedNodeIds: newNodes[0] ? [newNodes[0].id] : [],
            selectedEdgeId: null,
            camera: { x: 120, y: 90, zoom: 1 },
            nodes: newNodes,
            edges: newEdges
          };
          
          appData.activeId = newId;
          localStorage.setItem(APP_DATA_KEY, JSON.stringify(appData));
          queueCloudSave();
          
          showEditor(newId);
          autoLayout(); 
          saveState("✨ AI 已成功为你规划了节点路线！");
        }
      }

      // 触发 AI 补全选中节点的备注说明
      async function generateAIDescription() {
        const node = getSelectedNode();
        if (!node) return;
        if (!hasGeminiApiConfig()) {
          configureGeminiApiKey(generateAIDescription);
          return;
        }
        
        showLoading("AI 正在为你撰写说明...");
        
        const sys = "你是一位极具经验的项目执行顾问。根据用户提供的[节点名称]及[分类]，撰写一段约30~50字的专业执行说明。直接返回说明文本，不要有任何客套话。";
        const prompt = `节点名称: ${node.title}\n所属分类: ${node.category}\n请为该节点补充执行说明。`;
        
        const text = await callGeminiAPI(prompt, sys);
        hideLoading();
        
        if (text) {
          updateSelectedNode({ description: text });
          els.nodeDescriptionInput.value = text;
          saveState("✨ AI 已完成节点备注编写！");
        }
      }

      const statusLabels = {
        running: "进行中",
        done: "已完成",
        waiting: "等待中",
        failed: "失败",
      };

      const defaultState = {
        workflowTitle: "默认工作流表",
        projectCategory: "默认分组",
        updatedAt: Date.now(),
        selectedNodeId: "node-1",
        selectedNodeIds: ["node-1"],
        selectedEdgeId: null,
        camera: { x: 120, y: 90, zoom: 1 },
        nodes: [
          { id: "node-1", title: "初始化环境", status: "running", x: 70, y: 96, color: "#ffffff", category: "准备阶段", description: "准备运行目录、依赖缓存与基础配置。", linkUrl: "", linkText: "", imageData: "" },
          { id: "node-2", title: "依赖安装", status: "done", x: 290, y: 96, color: "#ffffff", category: "准备阶段", description: "安装并校验项目依赖。", linkUrl: "", linkText: "", imageData: "" },
          { id: "node-3", title: "提交质检", status: "done", x: 510, y: 96, color: "#ffffff", category: "开发与构建", description: "检查提交范围、命名和基础质量信号。", linkUrl: "", linkText: "", imageData: "" },
          { id: "node-4", title: "配置验证", status: "done", x: 730, y: 96, color: "#ffffff", category: "开发与构建", description: "验证配置项完整性与环境兼容性。", linkUrl: "", linkText: "", imageData: "" },
          { id: "node-5", title: "代码扫描", status: "done", x: 70, y: 508, color: "#ffffff", category: "开发与构建", description: "静态扫描代码风险与潜在异常路径。", linkUrl: "", linkText: "", imageData: "" },
          { id: "node-6", title: "构建编译", status: "done", x: 70, y: 272, color: "#ffffff", category: "开发与构建", description: "执行构建并收集产物信息。", linkUrl: "", linkText: "", imageData: "" },
          { id: "node-7", title: "单元测试", status: "running", x: 292, y: 292, color: "#ffffff", category: "测试验证", description: "运行核心单元测试并跟踪通过率。", linkUrl: "", linkText: "", imageData: "" },
          { id: "node-8", title: "集成测试", status: "waiting", x: 510, y: 292, color: "#ffffff", category: "测试验证", description: "等待单元测试完成后运行集成验证。", linkUrl: "", linkText: "", imageData: "" },
          { id: "node-9", title: "性能测试", status: "waiting", x: 70, y: 402, color: "#ffffff", category: "测试验证", description: "对关键路径做轻量性能检查。", linkUrl: "", linkText: "", imageData: "" },
          { id: "node-10", title: "部署验证", status: "waiting", x: 730, y: 292, color: "#ffffff", category: "发布部署", description: "收敛测试结果并执行部署前验证。", linkUrl: "", linkText: "", imageData: "" },
        ],
        edges: [
          { id: "edge-1", source: "node-1", target: "node-2" },
          { id: "edge-2", source: "node-2", target: "node-3" },
          { id: "edge-3", source: "node-3", target: "node-4" },
          { id: "edge-4", source: "node-3", target: "node-7" },
          { id: "edge-5", source: "node-4", target: "node-6" },
          { id: "edge-6", source: "node-6", target: "node-7" },
          { id: "edge-7", source: "node-7", target: "node-8" },
          { id: "edge-8", source: "node-8", target: "node-10" },
          { id: "edge-9", source: "node-6", target: "node-9" },
          { id: "edge-10", source: "node-9", target: "node-5" },
        ],
      };

      // ==== 弹窗拦截修复：自定义弹窗 ====
      function customConfirm(message, onConfirm) {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmTitle').textContent = "确认操作";
        document.getElementById('confirmMessage').textContent = message;
        document.getElementById('confirmInput').style.display = 'none';
        
        const cancelBtn = document.getElementById('confirmCancelBtn');
        cancelBtn.style.display = 'block';
        
        modal.style.display = 'flex';

        const okBtn = document.getElementById('confirmOkBtn');
        const cleanup = () => {
          modal.style.display = 'none';
          okBtn.onclick = null;
          cancelBtn.onclick = null;
        };
        okBtn.onclick = () => { cleanup(); onConfirm(); };
        cancelBtn.onclick = cleanup;
      }

      function customAlert(message) {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmTitle').textContent = "提示";
        document.getElementById('confirmMessage').textContent = message;
        document.getElementById('confirmInput').style.display = 'none';
        
        const cancelBtn = document.getElementById('confirmCancelBtn');
        cancelBtn.style.display = 'none';
        
        modal.style.display = 'flex';
        const okBtn = document.getElementById('confirmOkBtn');
        const cleanup = () => { modal.style.display = 'none'; okBtn.onclick = null; };
        okBtn.onclick = cleanup;
      }

      function customPrompt(title, message, defaultValue, onConfirm, inputType = "text") {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        
        const input = document.getElementById('confirmInput');
        input.type = inputType;
        input.style.display = 'block';
        input.value = defaultValue || '';
        
        const cancelBtn = document.getElementById('confirmCancelBtn');
        cancelBtn.style.display = 'block';

        modal.style.display = 'flex';
        input.focus();

        const okBtn = document.getElementById('confirmOkBtn');

        const cleanup = () => {
          modal.style.display = 'none';
          input.style.display = 'none';
          input.type = 'text';
          okBtn.onclick = null;
          cancelBtn.onclick = null;
        };

        okBtn.onclick = () => {
          const val = input.value.trim();
          cleanup();
          if (val) onConfirm(val);
        };
        cancelBtn.onclick = cleanup;
      }

      function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
      }

      function initAppData() {
        let data = null;
        try { data = JSON.parse(localStorage.getItem(APP_DATA_KEY)); } catch (e) {}

        if (!data || !data.data) {
          let legacyState = null;
          try { legacyState = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY)); } catch(e) {}
          
          const initialState = legacyState && legacyState.nodes ? legacyState : deepClone(defaultState);
          initialState.updatedAt = initialState.updatedAt || Date.now();
          initialState.projectCategory = initialState.projectCategory || "默认分组";
          
          data = { activeId: "ws-default", data: { "ws-default": initialState } };
        }

        if (!data.data[data.activeId]) data.activeId = Object.keys(data.data)[0] || "ws-default";

        for (const key in data.data) {
          const ws = data.data[key];
          data.data[key] = {
            workflowTitle: ws.workflowTitle || "未命名工作流",
            projectCategory: ws.projectCategory || "默认分组",
            updatedAt: ws.updatedAt || Date.now(),
            selectedNodeId: ws.selectedNodeId || null,
            selectedNodeIds: ws.selectedNodeIds || (ws.selectedNodeId ? [ws.selectedNodeId] : []),
            selectedEdgeId: ws.selectedEdgeId || null,
            camera: normalizeCamera(ws.camera, ws.zoom),
            nodes: (ws.nodes || []).map(normalizeNode),
            edges: (ws.edges || []).map(normalizeEdge),
          };
        }
        return data;
      }

      function createDefaultAppData() {
        const initialState = deepClone(defaultState);
        initialState.updatedAt = Date.now();
        return { activeId: "ws-default", data: { "ws-default": initialState } };
      }

      function getAppDataUpdatedAt(value) {
        if (!value || !value.data) return 0;
        return Math.max(
          0,
          ...Object.values(value.data).map((workspace) => Number(workspace?.updatedAt) || 0)
        );
      }

      function renderCurrentViewAfterSync() {
        if (els.editorView.classList.contains("active")) {
          render();
        } else {
          showDashboard();
          renderDashboard();
        }
      }

      function normalizeCamera(camera, legacyZoom) {
        return {
          x: Number.isFinite(camera?.x) ? camera.x : 120,
          y: Number.isFinite(camera?.y) ? camera.y : 90,
          zoom: clamp(Number.isFinite(camera?.zoom) ? camera.zoom : legacyZoom || 1, MIN_ZOOM, MAX_ZOOM),
        };
      }

      function normalizeNode(node) {
        return {
          id: String(node.id),
          title: node.title || "未命名节点",
          status: node.status || "waiting",
          x: Number.isFinite(node.x) ? node.x : 0,
          y: Number.isFinite(node.y) ? node.y : 0,
          width: Number.isFinite(node.width) ? node.width : null,
          height: Number.isFinite(node.height) ? node.height : null,
          color: node.color || "#ffffff",
          category: node.category || "默认分组",
          description: node.description || "",
          linkUrl: node.linkUrl || "",
          linkText: node.linkText || "",
          imageData: node.imageData || "",
        };
      }

      function normalizeEdge(edge) {
        const randomId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2);
        return {
          id: edge.id || `edge-${randomId}`,
          source: edge.source,
          target: edge.target,
        };
      }

      function getCategoryColor(category) {
        const palettes = [
          { bg: '#f3e8ff', text: '#9b51e0' }, // 紫色 
          { bg: '#eaf3ff', text: '#4b8df7' }, // 蓝色
          { bg: '#e9f8f0', text: '#35bd83' }, // 绿色
          { bg: '#fff3e4', text: '#f4a24c' }, // 橙色
          { bg: '#fff0f0', text: '#df5d61' }, // 红色
          { bg: '#f2f5f9', text: '#69758a' }  // 灰色 (默认)
        ];
        
        if (!category || category === '默认分组' || category === '未分类') {
          return palettes[5];
        }
        
        let hash = 0;
        for (let i = 0; i < category.length; i++) {
          hash = category.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % 5; 
        return palettes[index];
      }

      let appData = initAppData();
      let currentWorkspaceId = appData.activeId;
      let state = appData.data[currentWorkspaceId] || deepClone(defaultState);

      let searchTerm = "";
      let dragging = null;
      let panning = null;
      let boxSelecting = null;
      let resizing = null;
      let isConnectMode = false;
      let connectSourceId = null;
      let saveTimer = null;
      let cloudSaveTimer = null;
      let supabaseClient = null;
      let currentUser = null;
      let clipboard = []; 

      // === 历史撤销栈 ===
      let undoStack = [];
      
      function pushUndo() {
        const snap = JSON.stringify({ nodes: state.nodes, edges: state.edges });
        if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== snap) {
          undoStack.push(snap);
          if (undoStack.length > 50) undoStack.shift();
        }
      }

      function performUndo() {
        if (undoStack.length > 1) {
          undoStack.pop(); 
          const snap = JSON.parse(undoStack[undoStack.length - 1]);
          state.nodes = snap.nodes;
          state.edges = snap.edges;
          
          state.selectedNodeIds = state.selectedNodeIds.filter(id => state.nodes.some(n => n.id === id));
          if (!state.selectedNodeIds.includes(state.selectedNodeId)) {
            state.selectedNodeId = state.selectedNodeIds[0] || null;
          }
          
          appData.data[currentWorkspaceId] = state;
          localStorage.setItem(APP_DATA_KEY, JSON.stringify(appData));
          queueCloudSave();
          
          render();
          els.footerText.textContent = "已撤销上一步操作";
        } else {
          els.footerText.textContent = "没有可撤销的操作了";
        }
      }

      const els = {
        dashboardView: document.querySelector("#dashboardView"),
        editorView: document.querySelector("#editorView"),
        dashboardContent: document.querySelector("#dashboardContent"),
        backToDashBtn: document.querySelector("#backToDashBtn"),
        
        projectCategoryInput: document.querySelector("#projectCategoryInput"),
        projectCategoryDropdown: document.querySelector("#projectCategoryDropdown"),
        workflowTitleInput: document.querySelector("#workflowTitleInput"),
        nodeLayer: document.querySelector("#nodeLayer"),
        edgeLayer: document.querySelector("#edgeLayer"),
        nodeList: document.querySelector("#nodeList"),
        nodeCount: document.querySelector("#nodeCount"),
        searchInput: document.querySelector("#searchInput"),
        connectEdgeBtn: document.querySelector("#connectEdgeBtn"),
        deleteEdgeBtn: document.querySelector("#deleteEdgeBtn"),
        connectionHint: document.querySelector("#connectionHint"),
        canvasGrid: document.querySelector("#canvasGrid"),
        canvasViewport: document.querySelector("#canvasViewport"),
        selectionBox: document.querySelector("#selectionBox"),
        zoomLabel: document.querySelector("#zoomLabel"),
        miniMapSvg: document.querySelector("#miniMapSvg"),
        detailTitle: document.querySelector("#detailTitle"),
        nodeTitleInput: document.querySelector("#nodeTitleInput"),
        nodeCategorySelect: document.querySelector("#nodeCategorySelect"),
        nodeColorInput: document.querySelector("#nodeColorInput"),
        nodeDescriptionInput: document.querySelector("#nodeDescriptionInput"),
        nodeLinkUrlInput: document.querySelector("#nodeLinkUrlInput"),
        nodeLinkTextInput: document.querySelector("#nodeLinkTextInput"),
        nodeImageInput: document.querySelector("#nodeImageInput"),
        imagePreview: document.querySelector("#imagePreview"),
        removeImageBtn: document.querySelector("#removeImageBtn"),
        footerText: document.querySelector("#footerText"),
        newWorkspaceBtn: document.querySelector("#newWorkspaceBtn"),
        aiGenerateBtn: document.querySelector("#aiGenerateBtn"),
        aiDescBtn: document.querySelector("#aiDescBtn"),
        apiConfigBtn: document.querySelector("#apiConfigBtn"),
        exportWorkspaceBtn: document.querySelector("#exportWorkspaceBtn"),
        importWorkspaceBtn: document.querySelector("#importWorkspaceBtn"),
        importWorkspaceInput: document.querySelector("#importWorkspaceInput"),
        authStatus: document.querySelector("#authStatus"),
        loginOpenBtn: document.querySelector("#loginOpenBtn"),
        logoutBtn: document.querySelector("#logoutBtn"),
        authModal: document.querySelector("#authModal"),
        authEmailInput: document.querySelector("#authEmailInput"),
        authPasswordInput: document.querySelector("#authPasswordInput"),
        authCancelBtn: document.querySelector("#authCancelBtn"),
        authRegisterBtn: document.querySelector("#authRegisterBtn"),
        authLoginBtn: document.querySelector("#authLoginBtn")
      };

      function getSupabaseConfig() {
        const config = window.SUPABASE_CONFIG || {};
        return {
          url: String(config.url || "").trim(),
          anonKey: String(config.anonKey || "").trim(),
        };
      }

      function isSupabaseConfigured() {
        const config = getSupabaseConfig();
        return Boolean(
          config.url &&
          config.anonKey &&
          !config.url.includes("YOUR_PROJECT_REF") &&
          !config.anonKey.includes("YOUR_SUPABASE_ANON_KEY")
        );
      }

      function initSupabaseClient() {
        if (supabaseClient) return supabaseClient;
        if (!isSupabaseConfigured()) return null;
        if (!window.supabase || typeof window.supabase.createClient !== "function") return null;

        const config = getSupabaseConfig();
        supabaseClient = window.supabase.createClient(config.url, config.anonKey);
        return supabaseClient;
      }

      function setAuthUi(user) {
        if (!els.authStatus) return;
        const configured = isSupabaseConfigured();
        const sdkReady = Boolean(window.supabase && window.supabase.createClient);

        if (user) {
          els.authStatus.textContent = user.email || "已登录";
          els.loginOpenBtn.hidden = true;
          els.logoutBtn.hidden = false;
          return;
        }

        els.loginOpenBtn.hidden = false;
        els.logoutBtn.hidden = true;
        if (!configured) {
          els.authStatus.textContent = "本地模式";
          els.loginOpenBtn.title = "填写 supabase-config.js 后可登录同步";
        } else if (!sdkReady) {
          els.authStatus.textContent = "同步未加载";
          els.loginOpenBtn.title = "Supabase SDK 未加载，请检查网络或部署环境";
        } else {
          els.authStatus.textContent = "未登录";
          els.loginOpenBtn.title = "登录后按账号保存工作流";
        }
      }

      function openAuthModal() {
        if (!isSupabaseConfigured()) {
          customAlert("请先填写 supabase-config.js 中的 Supabase URL 和 anon key，再使用登录同步。");
          return;
        }
        if (!initSupabaseClient()) {
          customAlert("Supabase SDK 还没有加载成功，请检查网络或部署环境。");
          return;
        }
        els.authModal.style.display = "flex";
        els.authEmailInput.focus();
      }

      function closeAuthModal() {
        els.authModal.style.display = "none";
        els.authPasswordInput.value = "";
      }

      function getAuthFormValue() {
        const email = els.authEmailInput.value.trim();
        const password = els.authPasswordInput.value;
        if (!email || !password) {
          customAlert("请填写邮箱和密码。");
          return null;
        }
        if (password.length < 6) {
          customAlert("密码至少需要 6 位。");
          return null;
        }
        return { email, password };
      }

      async function signInUser() {
        const value = getAuthFormValue();
        if (!value || !initSupabaseClient()) return;
        showLoading("正在登录...");
        const { error } = await supabaseClient.auth.signInWithPassword(value);
        hideLoading();
        if (error) {
          customAlert(error.message || "登录失败，请检查邮箱和密码。");
          return;
        }
        closeAuthModal();
      }

      async function registerUser() {
        const value = getAuthFormValue();
        if (!value || !initSupabaseClient()) return;
        showLoading("正在注册...");
        const { error } = await supabaseClient.auth.signUp(value);
        hideLoading();
        if (error) {
          customAlert(error.message || "注册失败，请稍后再试。");
          return;
        }
        closeAuthModal();
        customAlert("注册成功。如果你的 Supabase 开启了邮箱验证，请先到邮箱完成验证后再登录。");
      }

      async function signOutUser() {
        if (!initSupabaseClient()) return;
        showLoading("正在退出...");
        await supabaseClient.auth.signOut();
        currentUser = null;
        hideLoading();
        setAuthUi(null);
        els.footerText.textContent = "已退出账号，当前使用本地模式";
      }

      function queueCloudSave() {
        if (!supabaseClient || !currentUser) return;
        window.clearTimeout(cloudSaveTimer);
        cloudSaveTimer = window.setTimeout(saveCloudAppDataNow, CLOUD_SAVE_DEBOUNCE_MS);
      }

      async function saveCloudAppDataNow() {
        if (!supabaseClient || !currentUser) return;
        const payload = {
          user_id: currentUser.id,
          app_data: appData,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabaseClient
          .from(SUPABASE_TABLE)
          .upsert(payload, { onConflict: "user_id" });

        if (error) {
          console.error("Supabase save failed:", error);
          els.footerText.textContent = "本地已保存，云端同步失败";
        } else {
          localStorage.setItem(APP_OWNER_KEY, currentUser.id);
        }
      }

      async function loadCloudAppData() {
        if (!supabaseClient || !currentUser) return;
        els.footerText.textContent = "正在后台同步云端数据...";

        const localSnapshot = appData;
        const localUpdatedAt = getAppDataUpdatedAt(localSnapshot);
        const localOwner = localStorage.getItem(APP_OWNER_KEY);

        const { data, error } = await supabaseClient
          .from(SUPABASE_TABLE)
          .select("app_data")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (error) {
          console.error("Supabase load failed:", error);
          els.footerText.textContent = "本地可用，云端读取失败";
          return;
        }

        if (!data?.app_data?.data) {
          if (localOwner && localOwner !== currentUser.id) {
            appData = createDefaultAppData();
            currentWorkspaceId = appData.activeId;
            state = appData.data[currentWorkspaceId];
            localStorage.setItem(APP_DATA_KEY, JSON.stringify(appData));
            localStorage.setItem(APP_OWNER_KEY, currentUser.id);
            undoStack = [];
            pushUndo();
            renderCurrentViewAfterSync();
          }
          await saveCloudAppDataNow();
          els.footerText.textContent = "云端同步完成";
          return;
        }

        const cloudAppData = data.app_data;
        const cloudUpdatedAt = getAppDataUpdatedAt(cloudAppData);

        if (cloudUpdatedAt > localUpdatedAt) {
          localStorage.setItem(APP_DATA_KEY, JSON.stringify(cloudAppData));
          localStorage.setItem(APP_OWNER_KEY, currentUser.id);
          appData = initAppData();
          currentWorkspaceId = appData.activeId;
          state = appData.data[currentWorkspaceId] || deepClone(defaultState);
          undoStack = [];
          pushUndo();
          renderCurrentViewAfterSync();
          els.footerText.textContent = "已加载云端最新数据";
        } else {
          localStorage.setItem(APP_OWNER_KEY, currentUser.id);
          await saveCloudAppDataNow();
          els.footerText.textContent = "本地数据已同步到云端";
        }
      }

      async function initAuth() {
        const client = initSupabaseClient();
        if (!client) {
          setAuthUi(null);
          return;
        }

        const { data } = await client.auth.getSession();
        currentUser = data.session?.user || null;
        setAuthUi(currentUser);
        if (currentUser) loadCloudAppData();

        client.auth.onAuthStateChange((_event, session) => {
          const nextUser = session?.user || null;
          const shouldLoadCloud = !currentUser && nextUser;
          currentUser = nextUser;
          setAuthUi(currentUser);
          if (shouldLoadCloud) loadCloudAppData();
        });
      }

      /* =======================
         自定义 Combo Box 下拉组件逻辑 (仅限顶部栏项目分类使用)
         ======================= */
      function initComboBox(inputEl, dropdownEl, getOptionsFn, onSelect) {
        function updateOptions() {
          const options = getOptionsFn();
          const val = inputEl.value.trim().toLowerCase();
          const filtered = options.filter(o => o.toLowerCase().includes(val));
          
          if (filtered.length === 0) {
            dropdownEl.classList.remove('show');
            return;
          }
          dropdownEl.innerHTML = filtered.map(c => `<div class="combo-option">${escapeHtml(c)}</div>`).join('');
          dropdownEl.classList.add('show');
        }

        inputEl.addEventListener('focus', updateOptions);
        inputEl.addEventListener('input', () => {
          updateOptions();
          onSelect(inputEl.value); 
        });

        dropdownEl.addEventListener('mousedown', (e) => {
          e.preventDefault(); 
          if (e.target.classList.contains('combo-option')) {
            const selectedVal = e.target.textContent;
            inputEl.value = selectedVal;
            onSelect(selectedVal);
            dropdownEl.classList.remove('show');
          }
        });

        inputEl.addEventListener('blur', () => {
          dropdownEl.classList.remove('show');
        });
      }

      // 初始化顶部项目的分类联想
      initComboBox(
        els.projectCategoryInput, 
        els.projectCategoryDropdown,
        () => Array.from(new Set(Object.values(appData.data).map(ws => ws.projectCategory).filter(c => c))),
        (val) => {
           state.projectCategory = val || "默认分组";
           queueSave();
        }
      );

      /* =======================
         视图控制逻辑
         ======================= */
      function showDashboard() {
        els.editorView.classList.remove('active');
        els.dashboardView.classList.add('active');
        renderDashboard();
      }

      function showEditor(workspaceId) {
        if(workspaceId) {
          switchWorkspace(workspaceId);
        }
        els.dashboardView.classList.remove('active');
        els.editorView.classList.add('active');
        fitToNodes();
      }

      function renderDashboard() {
        const workspaces = Object.entries(appData.data).map(([id, data]) => ({
          id,
          ...data
        })).sort((a, b) => b.updatedAt - a.updatedAt);

        const groups = {};
        workspaces.forEach(ws => {
          const cat = ws.projectCategory || "默认分组";
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(ws);
        });

        const catKeys = Object.keys(groups).sort((a, b) => {
           if(a === "默认分组") return -1;
           if(b === "默认分组") return 1;
           return a.localeCompare(b);
        });

        let html = '';

        catKeys.forEach((cat, index) => {
          html += `
            <div class="dashboard-group">
              <h2 class="group-title">${escapeHtml(cat)}</h2>
              <div class="project-grid">
          `;
          
          if (index === 0) {
            html += `
              <button class="project-card new-project" onclick="createNewWorkspace()">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>新建项目</span>
              </button>
            `;
          }

          groups[cat].forEach(ws => {
            const dateStr = new Date(ws.updatedAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
            
            const mockNodesHtml = (ws.nodes || []).slice(0, 5).map(node => {
              const left = Math.max(10, Math.min(80, (node.x / 1000) * 100)) + '%';
              const top = Math.max(10, Math.min(80, (node.y / 600) * 100)) + '%';
              return `<div class="mock-node" style="left: ${left}; top: ${top}; width: 30px; height: 12px;"></div>`;
            }).join('');

            html += `
              <div class="project-card existing-project" onclick="showEditor('${ws.id}')">
                 <div class="thumbnail">
                   <div class="mock-canvas-bg"></div>
                   ${mockNodesHtml}
                 </div>
                 <div class="info">
                   <h3>${escapeHtml(ws.workflowTitle)}</h3>
                   <p>更新于 ${dateStr}</p>
                 </div>
                 <button class="delete-project-btn" onclick="event.stopPropagation(); deleteWorkspace('${ws.id}')" title="删除项目">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                 </button>
              </div>
            `;
          });

          html += `</div></div>`;
        });

        if(catKeys.length === 0) {
           html = `
            <div class="dashboard-group">
              <h2 class="group-title">默认分组</h2>
              <div class="project-grid">
                <button class="project-card new-project" onclick="createNewWorkspace()">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span>新建项目</span>
                </button>
              </div>
            </div>
           `;
        }

        els.dashboardContent.innerHTML = html;
      }

      function createNewWorkspace() {
        const newId = `ws-${Date.now().toString(36)}`;
        const newState = {
          workflowTitle: "未命名项目",
          projectCategory: "默认分组", 
          updatedAt: Date.now(),
          selectedNodeId: null,
          selectedNodeIds: [],
          selectedEdgeId: null,
          camera: { x: 120, y: 90, zoom: 1 },
          nodes: [],
          edges: []
        };
        
        appData.data[newId] = newState;
        appData.activeId = newId;
        localStorage.setItem(APP_DATA_KEY, JSON.stringify(appData));
        queueCloudSave();
        showEditor(newId);
      }

      function deleteWorkspace(id) {
        customConfirm("确定要删除这个项目吗？操作不可恢复。", () => {
          delete appData.data[id];
          if (Object.keys(appData.data).length === 0) {
             appData.data["ws-default"] = deepClone(defaultState);
             appData.activeId = "ws-default";
          } else if (appData.activeId === id) {
             appData.activeId = Object.keys(appData.data)[0];
          }
          localStorage.setItem(APP_DATA_KEY, JSON.stringify(appData));
          queueCloudSave();
          renderDashboard(); 
        });
      }

      function switchWorkspace(id) {
        if (!appData.data[id]) return;
        currentWorkspaceId = id;
        appData.activeId = id;
        state = appData.data[id];
        
        isConnectMode = false;
        connectSourceId = null;
        undoStack = [];
        pushUndo();
        
        render();
        fitToNodes();
      }

      els.backToDashBtn.addEventListener("click", showDashboard);


      /* =======================
         编辑器核心逻辑
         ======================= */
      function saveState(message = "已自动保存到浏览器本地") {
        state.updatedAt = Date.now();
        appData.data[currentWorkspaceId] = state;
        appData.activeId = currentWorkspaceId;
        localStorage.setItem(APP_DATA_KEY, JSON.stringify(appData));
        queueCloudSave();
        
        pushUndo();
        
        els.footerText.textContent = message;
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => {
          els.footerText.textContent = "本地工作流已就绪";
        }, 1600);
      }

      function queueSave() {
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => saveState(), 250);
      }

      function getExportFileName() {
        const title = (state.workflowTitle || "workflow-board")
          .replace(/[\\/:*?"<>|]/g, "-")
          .replace(/\s+/g, "-")
          .slice(0, 60);
        const date = new Date().toISOString().slice(0, 10);
        return `${title || "workflow-board"}-${date}.json`;
      }

      function exportCurrentWorkspace() {
        const payload = {
          version: 1,
          exportedAt: new Date().toISOString(),
          workspace: {
            ...deepClone(state),
            updatedAt: Date.now(),
          },
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = getExportFileName();
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        els.footerText.textContent = "当前项目已导出到本地文件";
      }

      function normalizeImportedWorkspace(raw) {
        const imported = raw?.workspace || raw;
        if (!imported || !Array.isArray(imported.nodes) || !Array.isArray(imported.edges)) {
          throw new Error("文件格式不正确");
        }

        const nodeIds = new Set(imported.nodes.map((node) => String(node.id)));
        const selectedNodeId = nodeIds.has(imported.selectedNodeId) ? imported.selectedNodeId : imported.nodes[0]?.id || null;
        const selectedNodeIds = (imported.selectedNodeIds || []).filter((id) => nodeIds.has(id));

        return {
          workflowTitle: imported.workflowTitle || "导入的工作流",
          projectCategory: imported.projectCategory || "默认分组",
          updatedAt: Date.now(),
          selectedNodeId,
          selectedNodeIds: selectedNodeIds.length ? selectedNodeIds : (selectedNodeId ? [selectedNodeId] : []),
          selectedEdgeId: null,
          camera: normalizeCamera(imported.camera, imported.zoom),
          nodes: imported.nodes.map(normalizeNode),
          edges: imported.edges
            .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
            .map(normalizeEdge),
        };
      }

      function importWorkspaceFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.addEventListener("load", () => {
          try {
            const raw = JSON.parse(String(reader.result || "{}"));
            const importedWorkspace = normalizeImportedWorkspace(raw);
            customConfirm("导入会覆盖当前项目内容，确认继续？", () => {
              state = importedWorkspace;
              appData.data[currentWorkspaceId] = state;
              undoStack = [];
              pushUndo();
              render();
              fitToNodes();
              saveState("已导入文件并覆盖当前项目");
            });
          } catch (error) {
            console.error("Import failed:", error);
            customAlert("导入失败：请选择由本工具导出的 JSON 文件。");
          } finally {
            els.importWorkspaceInput.value = "";
          }
        });
        reader.addEventListener("error", () => {
          els.importWorkspaceInput.value = "";
          customAlert("文件读取失败，请重新选择。");
        });
        reader.readAsText(file, "utf-8");
      }

      function getNode(id) {
        return state.nodes.find((node) => node.id === id) || null;
      }

      function getSelectedNode() {
        return state.selectedNodeIds.length === 1 ? getNode(state.selectedNodeId) : null;
      }

      function viewportRect() {
        return els.canvasViewport.getBoundingClientRect();
      }

      function screenToWorld(clientX, clientY) {
        const rect = viewportRect();
        return {
          x: (clientX - rect.left - state.camera.x) / state.camera.zoom,
          y: (clientY - rect.top - state.camera.y) / state.camera.zoom,
        };
      }

      function worldToScreen(x, y) {
        return {
          x: x * state.camera.zoom + state.camera.x,
          y: y * state.camera.zoom + state.camera.y,
        };
      }

      function nodeCenter(node) {
        const el = els.nodeLayer.querySelector(`[data-id="${node.id}"]`);
        const w = el ? el.offsetWidth : (node.width || NODE_WIDTH);
        const h = el ? el.offsetHeight : (node.height || NODE_HEIGHT);
        return { x: node.x + w / 2, y: node.y + h / 2 };
      }

      function selectNode(id, center = false) {
        state.selectedNodeId = id;
        state.selectedNodeIds = id ? [id] : [];
        state.selectedEdgeId = null;
        isConnectMode = false;
        connectSourceId = null;
        if (center) centerNode(id);
        render();
        queueSave();
      }

      function centerNode(id) {
        const node = getNode(id);
        if (!node) return;
        const rect = viewportRect();
        const center = nodeCenter(node);
        state.camera.x = rect.width / 2 - center.x * state.camera.zoom;
        state.camera.y = rect.height / 2 - center.y * state.camera.zoom;
      }

      function fitToNodes() {
        if (!state.nodes || !state.nodes.length) {
          const rect = viewportRect();
          state.camera.zoom = 1;
          state.camera.x = rect.width / 2;
          state.camera.y = rect.height / 2;
          render();
          return;
        }
        const bounds = getNodeBounds(180);
        const rect = viewportRect();
        const zoom = Math.min(rect.width / bounds.width, rect.height / bounds.height, 1.2);
        state.camera.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
        state.camera.x = rect.width / 2 - (bounds.minX + bounds.width / 2) * state.camera.zoom;
        state.camera.y = rect.height / 2 - (bounds.minY + bounds.height / 2) * state.camera.zoom;
        render();
        queueSave();
      }

      function getNodeBounds(padding = 0) {
        if (!state.nodes.length) {
          return { minX: -500, minY: -300, maxX: 500, maxY: 300, width: 1000, height: 600 };
        }

        const minX = Math.min(...state.nodes.map((node) => node.x)) - padding;
        const minY = Math.min(...state.nodes.map((node) => node.y)) - padding;
        const maxX = Math.max(...state.nodes.map((node) => node.x + (node.width || NODE_WIDTH))) + padding;
        const maxY = Math.max(...state.nodes.map((node) => node.x + (node.height || NODE_HEIGHT))) + padding;
        return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
      }

      function render() {
        renderTitle();
        renderGrid();
        renderEdges();
        renderCanvas();
        renderList();
        renderDetail();
        renderMiniMap();
        renderToolbar();
      }

      function renderTitle() {
        const title = state.workflowTitle || "未命名工作流";
        const category = state.projectCategory || "默认分组";
        if (document.activeElement !== els.workflowTitleInput) {
          els.workflowTitleInput.value = title;
        }
        if (document.activeElement !== els.projectCategoryInput) {
          els.projectCategoryInput.value = category;
        }

        const projectCategories = Array.from(new Set(Object.keys(appData.data).map(key => appData.data[key].projectCategory).filter(c => c)));
        const pcHtml = projectCategories.map(cat => `<option value="${escapeHtml(cat)}"></option>`).join("");
        const datalist = document.getElementById("projectCategoryList");
        if (datalist && datalist.innerHTML !== pcHtml) {
            datalist.innerHTML = pcHtml;
        }

        document.title = title;
      }

      function renderGrid() {
        const size = GRID_SIZE * state.camera.zoom;
        els.canvasGrid.style.backgroundSize = `${size}px ${size}px`;
        els.canvasGrid.style.backgroundPosition = `${state.camera.x}px ${state.camera.y}px`;
        els.zoomLabel.textContent = `${Math.round(state.camera.zoom * 100)}%`;
      }

      function renderCanvas() {
        els.nodeLayer.style.transform = `translate(${state.camera.x}px, ${state.camera.y}px) scale(${state.camera.zoom})`;
        els.nodeLayer.innerHTML = "";

        state.nodes.forEach((node) => {
          const card = document.createElement("button");
          card.type = "button";
          const isAutoHeight = !node.height;
          card.className = `node-card ${node.status} ${state.selectedNodeIds.includes(node.id) ? "selected" : ""} ${isAutoHeight ? "auto-height" : ""}`;
          card.dataset.id = node.id;
          
          let styleStr = `left: ${node.x}px; top: ${node.y}px;`;
          if (node.width) styleStr += ` width: ${node.width}px;`;
          if (node.height) styleStr += ` height: ${node.height}px;`;
          if (node.color && node.color !== '#ffffff') styleStr += ` background-color: ${node.color};`;
          
          card.style.cssText = styleStr;

          const palette = getCategoryColor(node.category);
          const badgeMarkup = node.category
            ? `<span class="node-badge" style="background-color: ${palette.bg}; color: ${palette.text};">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M11.5,1.5L13.1,8.9L20.5,10.5L13.1,12.1L11.5,19.5L9.9,12.1L2.5,10.5L9.9,8.9L11.5,1.5ZM18.5,15.5L19.3,18.7L22.5,19.5L19.3,20.3L18.5,23.5L17.7,20.3L14.5,19.5L17.7,18.7L18.5,15.5Z"/></svg>
                 ${escapeHtml(node.category)}
               </span>`
            : "";

          const imageMarkup = node.imageData
            ? `<span class="node-image"><img src="${node.imageData}" alt="${escapeHtml(node.title)}" /></span>`
            : "";

          const linkMarkup = node.linkUrl
            ? `<a href="${escapeHtml(node.linkUrl)}" target="_blank" class="node-link" rel="noopener noreferrer" title="${escapeHtml(node.linkUrl)}">
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                 <span>${escapeHtml(node.linkText || "打开链接")}</span>
               </a>`
            : "";

          const resizeHandle = `
            <div class="node-resize-handle" data-id="${node.id}">
              <svg viewBox="0 0 12 12">
                <circle cx="10" cy="10" r="1.5"></circle>
                <circle cx="6" cy="10" r="1.5"></circle>
                <circle cx="10" cy="6" r="1.5"></circle>
                <circle cx="2" cy="10" r="1.5"></circle>
                <circle cx="6" cy="6" r="1.5"></circle>
                <circle cx="10" cy="2" r="1.5"></circle>
              </svg>
            </div>
          `;

          const descMarkup = node.description && node.description.trim() !== ""
            ? `<div class="node-sub"><span>${escapeHtml(node.description)}</span></div>`
            : "";

          card.innerHTML = `
            <div style="width: 100%; height: 100%; display: flex; flex-direction: column; flex: 1; min-height: 0;">
              ${badgeMarkup}
              ${imageMarkup}
              <span class="node-title" style="flex-shrink: 0;">${escapeHtml(node.title)}</span>
              ${descMarkup}
              ${linkMarkup}
            </div>
            ${resizeHandle}
          `;

          card.addEventListener("pointerdown", startDrag);
          card.addEventListener("click", () => handleNodeClick(node.id));

          const imgEl = card.querySelector('.node-image');
          if (imgEl) {
            imgEl.addEventListener('dblclick', (e) => {
              e.stopPropagation();
              const modal = document.getElementById('imagePreviewModal');
              document.getElementById('previewModalImg').src = node.imageData;
              modal.style.display = 'flex';
            });
          }

          els.nodeLayer.appendChild(card);
        });
      }

      function renderSelection() {
        els.nodeLayer.querySelectorAll(".node-card").forEach((card) => {
          card.classList.toggle("selected", state.selectedNodeIds.includes(card.dataset.id));
        });
        renderList();
        renderDetail();
        renderMiniMap();
        renderToolbar();
      }

      function renderEdges() {
        const rect = viewportRect();
        const zoom = state.camera.zoom;
        const viewX = -state.camera.x / zoom;
        const viewY = -state.camera.y / zoom;
        const viewW = Math.max(1, rect.width / zoom);
        const viewH = Math.max(1, rect.height / zoom);

        els.edgeLayer.setAttribute("viewBox", `${viewX} ${viewY} ${viewW} ${viewH}`);
        els.edgeLayer.innerHTML = "";

        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        defs.innerHTML = `
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#64c894"></path>
          </marker>
          <marker id="arrowSelected" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#4b8df7"></path>
          </marker>
        `;
        els.edgeLayer.appendChild(defs);

        const nodeRects = {};
        state.nodes.forEach(node => {
          const el = els.nodeLayer.querySelector(`[data-id="${node.id}"]`);
          nodeRects[node.id] = {
            w: el ? el.offsetWidth : (node.width || NODE_WIDTH),
            h: el ? el.offsetHeight : (node.height || NODE_HEIGHT)
          };
        });

        state.edges.forEach((edge) => {
          const source = getNode(edge.source);
          const target = getNode(edge.target);
          if (!source || !target) return;

          const sRect = nodeRects[source.id];
          const tRect = nodeRects[target.id];

          const sCx = source.x + sRect.w / 2;
          const sCy = source.y + sRect.h / 2;
          const tCx = target.x + tRect.w / 2;
          const tCy = target.y + tRect.h / 2;

          const dx = tCx - sCx;
          const dy = tCy - sCy;

          let start, end, cp1, cp2;

          if (Math.abs(dx) > Math.abs(dy)) {
            // 水平连接
            if (dx > 0) {
              start = { x: source.x + sRect.w, y: sCy }; 
              end = { x: target.x, y: tCy };             
            } else {
              start = { x: source.x, y: sCy };           
              end = { x: target.x + tRect.w, y: tCy };   
            }
            const dist = Math.max(50, Math.abs(end.x - start.x) / 2);
            cp1 = { x: start.x + (dx > 0 ? dist : -dist), y: start.y };
            cp2 = { x: end.x + (dx > 0 ? -dist : dist), y: end.y };
          } else {
            // 垂直连接
            if (dy > 0) {
              start = { x: sCx, y: source.y + sRect.h }; 
              end = { x: tCx, y: target.y };             
            } else {
              start = { x: sCx, y: source.y };           
              end = { x: tCx, y: target.y + tRect.h };   
            }
            const dist = Math.max(50, Math.abs(end.y - start.y) / 2);
            cp1 = { x: start.x, y: start.y + (dy > 0 ? dist : -dist) };
            cp2 = { x: end.x, y: end.y + (dy > 0 ? -dist : dist) };
          }

          const d = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;

          const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
          hitPath.setAttribute("d", d);
          hitPath.setAttribute("class", "edge-hit");
          hitPath.addEventListener("click", (event) => {
            event.stopPropagation();
            selectEdge(edge.id);
          });
          els.edgeLayer.appendChild(hitPath);

          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", d);
          path.setAttribute("class", `edge-path${edge.id === state.selectedEdgeId ? " selected" : ""}`);
          path.setAttribute("marker-end", edge.id === state.selectedEdgeId ? "url(#arrowSelected)" : "url(#arrow)");
          els.edgeLayer.appendChild(path);
        });
      }

      function renderList() {
        const filtered = state.nodes.filter((node) => node.title.toLowerCase().includes(searchTerm.toLowerCase()));
        els.nodeList.innerHTML = "";
        els.nodeCount.textContent = `${filtered.length}/${state.nodes.length}`;

        // 分组
        const grouped = {};
        filtered.forEach((node) => {
          const cat = node.category || "未分类";
          if(!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(node);
        });

        for(const cat in grouped) {
          const header = document.createElement("li");
          header.className = "category-header";
          
          const editSpan = document.createElement("span");
          editSpan.className = "category-title-edit";
          editSpan.contentEditable = "true";
          editSpan.dataset.oldCat = cat;
          editSpan.textContent = cat;
          
          header.appendChild(editSpan);
          els.nodeList.appendChild(header);

          const saveCategoryName = (e) => {
            const oldCat = e.target.dataset.oldCat;
            const newCat = e.target.textContent.trim();
            if (!newCat) {
              e.target.textContent = oldCat;
              return;
            }
            if (oldCat !== newCat) {
              state.nodes.forEach(n => {
                if (n.category === oldCat) n.category = newCat;
              });
              queueSave();
              render(); 
            }
          };

          editSpan.addEventListener('blur', saveCategoryName);
          editSpan.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.target.blur();
            }
          });

          grouped[cat].forEach((node) => {
            const item = document.createElement("li");
            item.innerHTML = `
              <button type="button" class="${state.selectedNodeIds.includes(node.id) ? "active" : ""}">
                <span class="status-dot ${node.status}"></span>
                <span class="title">${escapeHtml(node.title)}</span>
              </button>
            `;
            item.querySelector("button").addEventListener("click", () => selectNode(node.id, true));
            els.nodeList.appendChild(item);
          });
        }
      }

      function renderDetail() {
        const count = state.selectedNodeIds.length;
        const fields = [
          els.nodeTitleInput,
          els.nodeCategorySelect, // 这里使用 nodeCategorySelect
          els.nodeColorInput,
          els.nodeDescriptionInput,
          els.nodeLinkUrlInput,
          els.nodeLinkTextInput,
          els.nodeImageInput
        ];

        // 构建右侧节点分类组 Select 选项
        const categories = Array.from(new Set(state.nodes.map(n => n.category).filter(c => c)));
        let catHtml = '';
        categories.forEach(cat => {
          catHtml += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`;
        });
        catHtml += `<option disabled>──────────</option>`;
        catHtml += `<option value="__NEW__">➕ 新增分类...</option>`;
        
        if (els.nodeCategorySelect.innerHTML !== catHtml) {
            els.nodeCategorySelect.innerHTML = catHtml;
        }

        if (count === 0) {
          els.detailTitle.textContent = "未选择节点";
          els.imagePreview.innerHTML = "<span>未添加图片</span>";
          fields.forEach((field) => {
            if (field) {
              field.value = "";
              if (field.type === "color") field.value = "#ffffff";
              field.disabled = true;
            }
          });
          els.removeImageBtn.disabled = true;
          els.aiDescBtn.disabled = true;
          return;
        }

        if (count > 1) {
          els.detailTitle.textContent = `已选择 ${count} 个节点`;
          if (document.activeElement !== els.nodeTitleInput) els.nodeTitleInput.value = "（多个节点）";
          if (document.activeElement !== els.nodeCategorySelect) els.nodeCategorySelect.value = "";
          if (document.activeElement !== els.nodeColorInput) els.nodeColorInput.value = "#ffffff";
          if (document.activeElement !== els.nodeDescriptionInput) els.nodeDescriptionInput.value = "（批量选中，暂不支持合并修改属性）";
          if (document.activeElement !== els.nodeLinkUrlInput) els.nodeLinkUrlInput.value = "";
          if (document.activeElement !== els.nodeLinkTextInput) els.nodeLinkTextInput.value = "";
          
          els.imagePreview.innerHTML = "<span>多个节点不支持预览</span>";
          fields.forEach((field) => {
            if (field) field.disabled = true;
          });
          els.removeImageBtn.disabled = true;
          els.aiDescBtn.disabled = true;
          return;
        }

        const node = getSelectedNode();
        if (!node) return;

        fields.forEach((field) => {
          if (field) field.disabled = false;
        });
        els.aiDescBtn.disabled = false;
        els.removeImageBtn.disabled = !node.imageData;
        els.detailTitle.textContent = node.title;
        
        if (document.activeElement !== els.nodeTitleInput) els.nodeTitleInput.value = node.title;
        
        // 动态添加当前可能已被删除但节点仍持有的孤儿分类
        if (node && !categories.includes(node.category)) {
          els.nodeCategorySelect.insertAdjacentHTML('afterbegin', `<option value="${escapeHtml(node.category)}">${escapeHtml(node.category)}</option>`);
        }
        if (document.activeElement !== els.nodeCategorySelect) {
           els.nodeCategorySelect.value = node.category || "默认分组";
        }
        
        if (document.activeElement !== els.nodeColorInput) els.nodeColorInput.value = node.color || "#ffffff";
        if (document.activeElement !== els.nodeDescriptionInput) els.nodeDescriptionInput.value = node.description || "";
        if (document.activeElement !== els.nodeLinkUrlInput) els.nodeLinkUrlInput.value = node.linkUrl || "";
        if (document.activeElement !== els.nodeLinkTextInput) els.nodeLinkTextInput.value = node.linkText || "";
        
        if (document.activeElement !== els.nodeImageInput) els.nodeImageInput.value = "";
        
        if (!els.imagePreview.classList.contains('drag-over')) {
          els.imagePreview.innerHTML = node.imageData
            ? `<img src="${node.imageData}" alt="${escapeHtml(node.title)}" />`
            : "<span>未添加图片</span>";
        }
      }

      function renderMiniMap() {
        const bounds = getNodeBounds(120);
        const scale = Math.min(220 / bounds.width, 120 / bounds.height);
        const offsetX = (220 - bounds.width * scale) / 2;
        const offsetY = (120 - bounds.height * scale) / 2;

        const nodeRects = state.nodes
          .map((node) => {
            const color = node.status === "done" ? "#35bd83" : node.status === "running" ? "#4b8df7" : node.status === "failed" ? "#df5d61" : "#a7b0bf";
            const x = offsetX + (node.x - bounds.minX) * scale;
            const y = offsetY + (node.y - bounds.minY) * scale;
            const w = (node.width || NODE_WIDTH) * scale;
            const h = (node.height || 120) * scale;
            return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${color}" opacity="${state.selectedNodeIds.includes(node.id) ? "0.95" : "0.55"}" />`;
          })
          .join("");

        els.miniMapSvg.innerHTML = `<rect x="0" y="0" width="220" height="120" rx="5" fill="#f5f7fb" />${nodeRects}`;
      }

      function renderToolbar() {
        els.connectEdgeBtn.classList.toggle("active", isConnectMode);
        els.deleteEdgeBtn.disabled = !state.selectedEdgeId;

        if (isConnectMode && connectSourceId) {
          els.connectionHint.textContent = `选择目标节点：${getNode(connectSourceId)?.title || ""}`;
          return;
        }

        els.connectionHint.textContent = isConnectMode ? "先选择起点节点" : "Shift框选 | Ctrl拖拽或C/V复制 | Ctrl+Z撤销";
      }

      function startBoxSelect(event) {
        boxSelecting = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
        };
        els.canvasViewport.setPointerCapture(event.pointerId);
        els.selectionBox.hidden = false;
        els.selectionBox.style.left = `${event.clientX - viewportRect().left}px`;
        els.selectionBox.style.top = `${event.clientY - viewportRect().top}px`;
        els.selectionBox.style.width = `0px`;
        els.selectionBox.style.height = `0px`;
        
        state.selectedEdgeId = null;
        event.preventDefault();
      }

      function moveBoxSelect(event) {
        if (!boxSelecting) return;
        const rect = viewportRect();
        const currentX = event.clientX;
        const currentY = event.clientY;

        const left = Math.min(boxSelecting.startX, currentX) - rect.left;
        const top = Math.min(boxSelecting.startY, currentY) - rect.top;
        const width = Math.abs(currentX - boxSelecting.startX);
        const height = Math.abs(currentY - boxSelecting.startY);

        els.selectionBox.style.left = `${left}px`;
        els.selectionBox.style.top = `${top}px`;
        els.selectionBox.style.width = `${width}px`;
        els.selectionBox.style.height = `${height}px`;

        const startWorld = screenToWorld(boxSelecting.startX, boxSelecting.startY);
        const currentWorld = screenToWorld(currentX, currentY);
        const minX = Math.min(startWorld.x, currentWorld.x);
        const maxX = Math.max(startWorld.x, currentWorld.x);
        const minY = Math.min(startWorld.y, currentWorld.y);
        const maxY = Math.max(startWorld.y, currentWorld.y);

        const newSelection = [];
        state.nodes.forEach(node => {
          const w = node.width || NODE_WIDTH;
          const h = node.height || 120;
          if (!(node.x + w < minX || node.x > maxX || node.y + h < minY || node.y > maxY)) {
            newSelection.push(node.id);
          }
        });

        state.selectedNodeIds = newSelection;
        if (!newSelection.includes(state.selectedNodeId)) {
          state.selectedNodeId = newSelection[0] || null;
        }
        renderSelection();
      }

      function endBoxSelect() {
        if (!boxSelecting) return;
        if (els.canvasViewport.hasPointerCapture?.(boxSelecting.pointerId)) {
          els.canvasViewport.releasePointerCapture(boxSelecting.pointerId);
        }
        boxSelecting = null;
        els.selectionBox.hidden = true;
        renderDetail();
        queueSave();
      }

      function startResize(event) {
        const handle = event.target.closest('.node-resize-handle');
        if (!handle) return;
        const node = getNode(handle.dataset.id);
        if (!node) return;
        
        const cardEl = els.nodeLayer.querySelector(`[data-id="${node.id}"]`);
        const currentW = node.width || cardEl.offsetWidth;
        const currentH = node.height || cardEl.offsetHeight;

        resizing = {
          id: node.id,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startW: currentW,
          startH: currentH
        };
        
        handle.setPointerCapture(event.pointerId);
        event.stopPropagation();
        event.preventDefault();
      }

      function moveResize(event) {
        if (!resizing) return;
        const node = getNode(resizing.id);
        if (!node) return;

        const dx = (event.clientX - resizing.startX) / state.camera.zoom;
        const dy = (event.clientY - resizing.startY) / state.camera.zoom;
        
        node.width = Math.max(120, resizing.startW + dx);
        node.height = Math.max(70, resizing.startH + dy);
        
        const el = els.nodeLayer.querySelector(`[data-id="${node.id}"]`);
        if (el) {
          el.style.width = `${node.width}px`;
          el.style.height = `${node.height}px`;
          el.classList.remove('auto-height'); 
        }
        
        renderEdges();
        renderMiniMap();
      }

      function endResize(event) {
        if (!resizing) return;
        if (els.canvasViewport.hasPointerCapture?.(resizing.pointerId)) {
          els.canvasViewport.releasePointerCapture(resizing.pointerId);
        }
        resizing = null;
        renderDetail();
        queueSave();
      }

      function startDrag(event) {
        if (event.button !== 0 || isConnectMode) return;
        
        if (event.target.closest('.node-link')) return;
        if (event.target.closest('.node-resize-handle')) {
          startResize(event);
          return;
        }

        const node = getNode(event.currentTarget.dataset.id);
        if (!node) return;

        const imgTarget = event.target.closest('.node-image');
        if (imgTarget) {
          const now = Date.now();
          const lastTime = parseInt(imgTarget.dataset.lastClick || "0", 10);
          if (now - lastTime < 300) { 
            imgTarget.dataset.lastClick = "0"; 
            const modal = document.getElementById('imagePreviewModal');
            document.getElementById('previewModalImg').src = node.imageData;
            modal.style.display = 'flex';
            return; 
          } else {
            imgTarget.dataset.lastClick = now.toString();
          }
        }

        event.currentTarget.setPointerCapture(event.pointerId);

        let targetIds = [...state.selectedNodeIds];

        if (event.shiftKey) {
          if (state.selectedNodeIds.includes(node.id)) {
            state.selectedNodeIds = state.selectedNodeIds.filter(id => id !== node.id);
            targetIds = [...state.selectedNodeIds];
            if (state.selectedNodeId === node.id) state.selectedNodeId = state.selectedNodeIds[0] || null;
          } else {
            state.selectedNodeIds.push(node.id);
            state.selectedNodeId = node.id;
            targetIds = [...state.selectedNodeIds];
          }
        } else {
          if (!state.selectedNodeIds.includes(node.id)) {
            state.selectedNodeIds = [node.id];
            state.selectedNodeId = node.id;
            targetIds = [node.id];
          }
        }

        if (event.ctrlKey || event.metaKey) {
          const newIds = [];
          targetIds.forEach(id => {
            const original = getNode(id);
            if (!original) return;
            const newId = `node-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
            newIds.push(newId);
            const clone = deepClone(original);
            clone.id = newId;
            clone.status = "waiting";
            state.nodes.push(clone);
          });
          state.selectedNodeIds = newIds;
          state.selectedNodeId = newIds[0];
          targetIds = newIds;
          
          renderCanvas(); 
        }

        state.selectedEdgeId = null;
        dragging = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          hasMoved: false,        
          clickedId: node.id,     
          nodes: targetIds.map(id => ({
            id,
            nodeX: getNode(id).x,
            nodeY: getNode(id).y
          }))
        };
        renderSelection();
        event.preventDefault();
      }

      function moveDrag(event) {
        if (!dragging) return;
        
        if (Math.abs(event.clientX - dragging.startX) > 3 || Math.abs(event.clientY - dragging.startY) > 3) {
          dragging.hasMoved = true;
        }

        const dx = (event.clientX - dragging.startX) / state.camera.zoom;
        const dy = (event.clientY - dragging.startY) / state.camera.zoom;

        dragging.nodes.forEach(dn => {
          const node = getNode(dn.id);
          if (node) {
            node.x = dn.nodeX + dx;
            node.y = dn.nodeY + dy;
            
            const el = els.nodeLayer.querySelector(`[data-id="${node.id}"]`);
            if (el) {
              el.style.left = `${node.x}px`;
              el.style.top = `${node.y}px`;
            }
          }
        });
        
        renderEdges();
        renderMiniMap();
      }

      function endDrag(event) {
        if (!dragging) return;
        
        if (!dragging.hasMoved && event && !event.shiftKey) {
          if (state.selectedNodeIds.length > 1 && state.selectedNodeIds.includes(dragging.clickedId)) {
            state.selectedNodeIds = [dragging.clickedId];
            state.selectedNodeId = dragging.clickedId;
            renderSelection();
          }
        }
        
        dragging = null;
        renderDetail();
        queueSave();
      }

      function startPan(event) {
        if (event.button !== 1) return;
        panning = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          cameraX: state.camera.x,
          cameraY: state.camera.y,
        };
        els.canvasViewport.setPointerCapture(event.pointerId);
        els.canvasViewport.classList.add("panning");
        event.preventDefault();
      }

      function movePan(event) {
        if (!panning) return;
        state.camera.x = panning.cameraX + event.clientX - panning.startX;
        state.camera.y = panning.cameraY + event.clientY - panning.startY;
        renderGrid();
        renderEdges();
        els.nodeLayer.style.transform = `translate(${state.camera.x}px, ${state.camera.y}px) scale(${state.camera.zoom})`;
        queueSave();
      }

      function endPan() {
        if (!panning) return;
        if (els.canvasViewport.hasPointerCapture?.(panning.pointerId)) {
          els.canvasViewport.releasePointerCapture(panning.pointerId);
        }
        panning = null;
        els.canvasViewport.classList.remove("panning");
      }

      function handleNodeClick(id) {
        if (isConnectMode) {
          connectNode(id);
          return;
        }
      }

      function updateSelectedNode(patch) {
        if (state.selectedNodeIds.length !== 1) return;
        const node = getSelectedNode();
        if (!node) return;
        Object.assign(node, patch);
        
        renderCanvas();
        renderList();
        queueSave();
      }

      function addNode() {
        const id = `node-${Date.now().toString(36)}`;
        const rect = viewportRect();
        const center = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const lastNode = state.nodes[state.nodes.length - 1];
        
        const defaultCat = lastNode && lastNode.category ? lastNode.category : "默认分组";
        
        const node = {
          id,
          title: `新节点 ${state.nodes.length + 1}`,
          status: "waiting",
          x: center.x - NODE_WIDTH / 2,
          y: center.y - NODE_HEIGHT / 2,
          category: defaultCat,
          color: "#ffffff",
          description: "填写这个节点的执行说明。",
          linkUrl: "",
          linkText: "",
          imageData: "",
        };

        state.nodes.push(node);
        if (lastNode) {
          state.edges.push({ id: `edge-${Date.now().toString(36)}`, source: lastNode.id, target: id });
        }
        selectNode(id);
        saveState("已新增节点并保存");
      }

      function deleteSelectedNode() {
        if (state.selectedNodeIds.length === 0) return;
        const count = state.selectedNodeIds.length;
        const msg = count === 1 ? `删除“${getNode(state.selectedNodeIds[0])?.title}”？` : `删除这 ${count} 个节点？`;
        
        customConfirm(`${msg}相关连线也会移除。`, () => {
          state.nodes = state.nodes.filter((item) => !state.selectedNodeIds.includes(item.id));
          state.edges = state.edges.filter((edge) => !state.selectedNodeIds.includes(edge.source) && !state.selectedNodeIds.includes(edge.target));
          
          state.selectedNodeIds = [];
          state.selectedNodeId = state.nodes[0]?.id || null;
          if (state.selectedNodeId) state.selectedNodeIds.push(state.selectedNodeId);
          
          state.selectedEdgeId = null;
          render();
          saveState("已删除节点并保存");
        });
      }

      function selectEdge(id) {
        state.selectedEdgeId = id;
        isConnectMode = false;
        connectSourceId = null;
        renderEdges();
        renderToolbar();
        queueSave();
      }

      function toggleConnectMode() {
        isConnectMode = !isConnectMode;
        connectSourceId = null;
        state.selectedEdgeId = null;
        renderEdges();
        renderToolbar();
      }

      function connectNode(id) {
        if (!connectSourceId) {
          connectSourceId = id;
          state.selectedNodeId = id;
          state.selectedNodeIds = [id];
          render();
          return;
        }

        if (connectSourceId !== id && !state.edges.some((edge) => edge.source === connectSourceId && edge.target === id)) {
          const edge = { id: `edge-${Date.now().toString(36)}`, source: connectSourceId, target: id };
          state.edges.push(edge);
          state.selectedEdgeId = edge.id;
        }

        isConnectMode = false;
        connectSourceId = null;
        render();
        saveState("已新增连线");
      }

      function deleteSelectedEdge() {
        if (!state.selectedEdgeId) return;
        state.edges = state.edges.filter((edge) => edge.id !== state.selectedEdgeId);
        state.selectedEdgeId = null;
        render();
        saveState("已删除连线");
      }

      function autoLayout() {
        if (!state.nodes || !state.nodes.length) return;

        const inDegree = {};
        const adjList = {};
        state.nodes.forEach(n => {
          inDegree[n.id] = 0;
          adjList[n.id] = [];
        });

        state.edges.forEach(e => {
          if (inDegree[e.target] !== undefined && adjList[e.source]) {
            inDegree[e.target]++;
            adjList[e.source].push(e.target);
          }
        });

        const layers = [];
        let queue = state.nodes.filter(n => inDegree[n.id] === 0);
        const visited = new Set(queue.map(n => n.id));
        
        if (queue.length === 0 && state.nodes.length > 0) {
          queue.push(state.nodes[0]);
          visited.add(state.nodes[0].id);
        }

        while (queue.length > 0) {
          layers.push(queue);
          const nextQueue = [];
          queue.forEach(node => {
            adjList[node.id].forEach(targetId => {
              inDegree[targetId]--;
              if (inDegree[targetId] <= 0 && !visited.has(targetId)) {
                visited.add(targetId);
                const tNode = state.nodes.find(n => n.id === targetId);
                if (tNode) nextQueue.push(tNode);
              }
            });
          });
          queue = nextQueue;
        }

        const unvisited = state.nodes.filter(n => !visited.has(n.id));
        if (unvisited.length > 0) {
          layers.push(unvisited);
        }

        const gapX = 160; 
        const gapY = 80;  
        let currentX = 70;
        
        const nodeDims = {};
        state.nodes.forEach(node => {
          const el = els.nodeLayer.querySelector(`[data-id="${node.id}"]`);
          nodeDims[node.id] = {
            w: node.width || (el ? el.offsetWidth : NODE_WIDTH),
            h: node.height || (el ? el.offsetHeight : 120)
          };
        });

        let maxLayerHeight = 0;
        const layerHeights = layers.map(layer => {
          const h = layer.reduce((sum, node) => sum + nodeDims[node.id].h + gapY, 0) - gapY;
          if (h > maxLayerHeight) maxLayerHeight = h;
          return Math.max(0, h);
        });

        layers.forEach((layerNodes, i) => {
          let maxW = 0;
          const layerH = layerHeights[i];
          let currentY = 96 + (maxLayerHeight - layerH) / 2; 
          
          layerNodes.forEach(node => {
            const dims = nodeDims[node.id];
            node.x = currentX;
            node.y = currentY;
            
            const el = els.nodeLayer.querySelector(`[data-id="${node.id}"]`);
            if (el) {
              el.style.left = `${node.x}px`;
              el.style.top = `${node.y}px`;
            }
            
            currentY += dims.h + gapY;
            if (dims.w > maxW) maxW = dims.w;
          });
          
          currentX += maxW + gapX;
        });

        renderEdges();
        renderMiniMap();
        fitToNodes();
        saveState("已智能排版并保存");
      }

      function setZoom(nextZoom, anchorClientX = null, anchorClientY = null) {
        const rect = viewportRect();
        const anchorX = anchorClientX ?? rect.left + rect.width / 2;
        const anchorY = anchorClientY ?? rect.top + rect.height / 2;
        const before = screenToWorld(anchorX, anchorY);

        state.camera.zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
        const afterScreenX = before.x * state.camera.zoom + state.camera.x;
        const afterScreenY = before.y * state.camera.zoom + state.camera.y;
        state.camera.x += anchorX - rect.left - afterScreenX;
        state.camera.y += anchorY - rect.top - afterScreenY;
        render();
        queueSave();
      }

      function zoomWithWheel(event) {
        event.preventDefault();
        setZoom(state.camera.zoom + (event.deltaY > 0 ? -0.08 : 0.08), event.clientX, event.clientY);
      }

      function addNodeImage(file) {
        if (state.selectedNodeIds.length !== 1) return;
        const node = getSelectedNode();
        if (!node || !file) return;
        if (!file.type.startsWith("image/")) {
          els.footerText.textContent = "请选择图片文件";
          return;
        }

        const reader = new FileReader();
        reader.addEventListener("load", () => {
          node.imageData = reader.result;
          render();
          saveState("已添加节点图片");
        });
        reader.readAsDataURL(file);
      }

      function removeNodeImage() {
        if (state.selectedNodeIds.length !== 1) return;
        const node = getSelectedNode();
        if (!node) return;
        node.imageData = "";
        render();
        saveState("已移除节点图片");
      }

      function resetExample() {
        customConfirm("恢复当前示例会覆盖当前工作区数据，确认继续？", () => {
          state = deepClone(defaultState);
          isConnectMode = false;
          connectSourceId = null;
          render();
          setTimeout(fitToNodes, 0);
          saveState("已恢复当前示例");
        });
      }

      function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      // UI 事件监听
      els.searchInput.addEventListener("input", (event) => {
        searchTerm = event.target.value;
        renderList();
      });

      els.workflowTitleInput.addEventListener("input", (event) => {
        state.workflowTitle = event.target.value || "未命名工作流";
        renderTitle();
        queueSave();
      });

      els.nodeTitleInput.addEventListener("input", (event) => updateSelectedNode({ title: event.target.value || "未命名节点" }));
      
      // === 修改点：节点分类输入监听 ===
      els.nodeCategorySelect.addEventListener("change", (event) => {
        if (event.target.value === "__NEW__") {
          const node = getSelectedNode();
          if (node) event.target.value = node.category || "默认分组"; 
          
          customPrompt("新增分类", "请输入新分类的名称：", "", (newCat) => {
            if (newCat) {
              updateSelectedNode({ category: newCat });
              renderDetail(); 
            }
          });
        } else {
          updateSelectedNode({ category: event.target.value });
        }
      });

      els.nodeColorInput.addEventListener("input", (event) => updateSelectedNode({ color: event.target.value }));
      els.nodeDescriptionInput.addEventListener("input", (event) => updateSelectedNode({ description: event.target.value }));
      els.nodeLinkUrlInput.addEventListener("input", (event) => updateSelectedNode({ linkUrl: event.target.value }));
      els.nodeLinkTextInput.addEventListener("input", (event) => updateSelectedNode({ linkText: event.target.value }));
      
      els.nodeTitleInput.addEventListener("blur", () => renderDetail());
      els.nodeDescriptionInput.addEventListener("blur", () => renderDetail());

      els.nodeImageInput.addEventListener("change", (event) => addNodeImage(event.target.files?.[0]));
      els.removeImageBtn.addEventListener("click", removeNodeImage);

      document.querySelector("#addNodeBtn").addEventListener("click", addNode);
      document.querySelector("#saveBtn").addEventListener("click", () => saveState("已手动保存"));
      els.exportWorkspaceBtn.addEventListener("click", exportCurrentWorkspace);
      els.importWorkspaceBtn.addEventListener("click", () => els.importWorkspaceInput.click());
      els.importWorkspaceInput.addEventListener("change", (event) => importWorkspaceFile(event.target.files?.[0]));
      document.querySelector("#deleteNodeBtn").addEventListener("click", deleteSelectedNode);
      document.querySelector("#fitBtn").addEventListener("click", autoLayout);
      els.connectEdgeBtn.addEventListener("click", toggleConnectMode);
      els.deleteEdgeBtn.addEventListener("click", deleteSelectedEdge);
      document.querySelector("#resetBtn").addEventListener("click", resetExample);
      els.newWorkspaceBtn.addEventListener("click", createNewWorkspace);
      document.querySelector("#zoomInBtn").addEventListener("click", () => setZoom(state.camera.zoom + 0.1));
      document.querySelector("#zoomOutBtn").addEventListener("click", () => setZoom(state.camera.zoom - 0.1));
      document.querySelector("#miniPlus").addEventListener("click", () => setZoom(state.camera.zoom + 0.1));
      document.querySelector("#miniMinus").addEventListener("click", () => setZoom(state.camera.zoom - 0.1));

      els.aiGenerateBtn.addEventListener("click", () => {
        customPrompt("✨ 智能生成工作流", "请输入你想做的工作任务或流程主题：", "策划一场产品发布会", (val) => {
          generateAIWorkflow(val);
        });
      });
      els.aiDescBtn.addEventListener("click", generateAIDescription);
      els.apiConfigBtn.addEventListener("click", () => configureGeminiApiKey());
      els.loginOpenBtn.addEventListener("click", openAuthModal);
      els.logoutBtn.addEventListener("click", signOutUser);
      els.authCancelBtn.addEventListener("click", closeAuthModal);
      els.authLoginBtn.addEventListener("click", signInUser);
      els.authRegisterBtn.addEventListener("click", registerUser);
      els.authModal.addEventListener("click", (event) => {
        if (event.target === els.authModal) closeAuthModal();
      });

      // 画布指针事件
      els.canvasViewport.addEventListener("pointerdown", (event) => {
        const isBackground = !event.target.closest('.node-card');
        if (isBackground && event.shiftKey && event.button === 0) {
          startBoxSelect(event);
        } else {
          startPan(event);
        }
      });

      window.addEventListener("pointermove", (event) => {
        if (typeof moveDrag === 'function') moveDrag(event);
        if (typeof movePan === 'function') movePan(event);
        if (typeof moveBoxSelect === 'function') moveBoxSelect(event);
        if (typeof moveResize === 'function') moveResize(event);
      });

      window.addEventListener("pointerup", (event) => {
        if (typeof endDrag === 'function') endDrag(event); 
        if (typeof endPan === 'function') endPan();
        if (typeof endBoxSelect === 'function') endBoxSelect();
        if (typeof endResize === 'function') endResize(event);
      });

      window.addEventListener("resize", () => {
         if(els.editorView.classList.contains("active")) {
           render();
         }
      });
      
      els.canvasViewport.addEventListener("wheel", zoomWithWheel, { passive: false });
      els.canvasViewport.addEventListener("auxclick", (event) => event.preventDefault());

      // 键盘快捷键支持 (复制/粘贴/删除/撤销)
      window.addEventListener("keydown", (event) => {
        if (!els.editorView.classList.contains("active")) return;
        const tagName = event.target?.tagName;
        if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || event.target?.isContentEditable) return;
        
        if (event.key === "Delete" || event.key === "Backspace") {
          if (state.selectedNodeIds.length > 0) {
            deleteSelectedNode(); 
          } else if (state.selectedEdgeId) {
            deleteSelectedEdge();
          }
          return;
        }

        if (event.ctrlKey || event.metaKey) {
          // 撤销 Ctrl+Z
          if (event.key.toLowerCase() === 'z') {
            event.preventDefault();
            performUndo();
            return;
          }

          // 复制 Ctrl+C
          if (event.key.toLowerCase() === 'c') {
            clipboard = state.selectedNodeIds.map(id => deepClone(getNode(id)));
          } 
          // 粘贴 Ctrl+V
          else if (event.key.toLowerCase() === 'v') {
            if (clipboard.length > 0) {
              const newIds = [];
              clipboard.forEach(original => {
                const newId = `node-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
                newIds.push(newId);
                const clone = { ...original, id: newId, x: original.x + 20, y: original.y + 20, status: "waiting" };
                state.nodes.push(clone);
                original.x += 20;
                original.y += 20;
              });
              state.selectedNodeIds = newIds;
              state.selectedNodeId = newIds[0];
              render();
              saveState("已粘贴节点");
            }
          }
        }
      });

      // 画布：处理批量拖入图片创建多个新节点
      els.canvasViewport.addEventListener("dragover", (event) => {
        event.preventDefault(); 
        if (event.dataTransfer.types.includes("Files")) {
          els.canvasViewport.classList.add("drag-over");
        }
      });
      els.canvasViewport.addEventListener("dragleave", (event) => {
        event.preventDefault();
        els.canvasViewport.classList.remove("drag-over");
      });
      els.canvasViewport.addEventListener("drop", (event) => {
        event.preventDefault();
        els.canvasViewport.classList.remove("drag-over");

        // 过滤出所有的图片文件
        const files = Array.from(event.dataTransfer.files).filter(f => f.type.startsWith("image/"));
        if (files.length === 0) return;

        const worldPos = screenToWorld(event.clientX, event.clientY);
        
        // 批量读取所有图片
        Promise.all(files.map((file, index) => {
          return new Promise(resolve => {
            const reader = new FileReader();
            reader.addEventListener("load", (e) => {
              resolve({ dataUrl: e.target.result, file, index });
            });
            reader.readAsDataURL(file);
          });
        })).then(results => {
          const newIds = [];
          results.forEach(({ dataUrl, index }) => {
            const id = `node-${Date.now().toString(36)}-${Math.random().toString(36).substring(2,5)}`;
            const lastNode = state.nodes[state.nodes.length - 1];
            const defaultCat = lastNode && lastNode.category ? lastNode.category : "默认分组";

            const node = {
              id,
              title: `图片节点 ${index + 1}`,
              status: "waiting",
              // 分别产生一定的坐标偏移，错开排列
              x: worldPos.x - NODE_WIDTH / 2 + (index * 25), 
              y: worldPos.y - 70 / 2 + (index * 25), 
              category: defaultCat,
              color: "#ffffff",
              description: "",
              linkUrl: "",
              linkText: "",
              imageData: dataUrl,
            };

            state.nodes.push(node);
            newIds.push(id);
          });
          
          state.selectedNodeIds = newIds;
          state.selectedNodeId = newIds[0];
          render();
          saveState(`已批量生成 ${results.length} 个图片节点`);
        });
      });

      // 属性面板：处理拖入图片替换节点图片
      els.imagePreview.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (event.dataTransfer.types.includes("Files")) {
          els.imagePreview.classList.add("drag-over");
        }
      });
      els.imagePreview.addEventListener("dragleave", (event) => {
        event.preventDefault();
        els.imagePreview.classList.remove("drag-over");
      });
      els.imagePreview.addEventListener("drop", (event) => {
        event.preventDefault();
        els.imagePreview.classList.remove("drag-over");
        const file = event.dataTransfer.files?.[0];
        if (file) {
          addNodeImage(file);
        }
      });

      // 关闭大图预览
      document.getElementById('imagePreviewModal').addEventListener('click', function() {
        this.style.display = 'none';
      });

      // 启动并渲染控制台主页
      renderApiConfigState();
      showDashboard();
      initAuth();
      
      // 初始化撤销栈
      pushUndo();
