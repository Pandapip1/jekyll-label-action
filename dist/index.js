/******/ /* webpack/runtime/compat */
/******/ 
/******/ if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = new URL('.', import.meta.url).pathname.slice(import.meta.url.match(/^file:\/\/\/\w:/) ? 1 : 0, -1) + "/";
/******/ 
/************************************************************************/
var __webpack_exports__ = {};

var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (undefined && undefined.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = __importDefault(require("@actions/core"));
const github_1 = __importDefault(require("@actions/github"));
const front_matter_1 = __importDefault(require("front-matter"));
const yaml_1 = require("yaml");
function isConditionMet(templateString, templateVars) {
    return new Function(`return ${templateString};`).call(templateVars); // Magic
}
function getLabelsFromConfig(newFm, oldFm, config) {
    return __awaiter(this, void 0, void 0, function* () {
        let result = new Set();
        let context = {
            "new": newFm,
            "old": oldFm
        };
        for (let label in config) {
            if (isConditionMet(config[label], context)) {
                result.add(label);
            }
        }
        return [...result];
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(core_1.default);
        // Initialize GitHub API
        const GITHUB_TOKEN = core_1.default.getInput('token');
        const octokit = github_1.default.getOctokit(GITHUB_TOKEN);
        // Deconstruct the payload
        const { context } = github_1.default;
        const { payload } = context;
        const { repo, pull } = payload;
        // Parse config file
        const response = yield octokit.request(`GET /repos/${repo.owner.login}/${repo.name}/contents/.jekyll-labels.yml`);
        if (response.status !== 200) {
            core_1.default.setFailed('Could not find .jekyll-labels.yml');
            process.exit(1);
        }
        const config = (0, yaml_1.parse)(Buffer.from(response.data.content, "base64").toString("utf8"));
        // Initialize labels
        const labels = new Set();
        // Iterate through changed files
        const fetched = yield octokit.paginate(octokit.rest.pulls.listFiles, {
            owner: pull.base.repo.owner.login,
            repo: pull.base.repo.name,
            pull_number: pull.number,
        });
        // Be awed by the speed of doing everything in parallel
        yield Promise.all(fetched.map(function (file) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!file.filename.endsWith(".md")) {
                    return; // Jekyll only renders markdown files
                }
                if (file.status !== "modified" && file.status !== "added" && file.status !== "removed") {
                    return; // File unmodified
                }
                let newFm = {};
                let oldFm = {};
                if (file.status === "removed" || file.status === "modified") {
                    const response = yield octokit.request(`GET /repos/${repo.owner.login}/${repo.name}/contents/${file.filename}`);
                    const content = Buffer.from(response.data.content, "base64").toString("utf8");
                    oldFm = (0, front_matter_1.default)(content).attributes;
                }
                if (file.status === "added" || file.status === "modified") {
                    const response = yield octokit.request(`GET /repos/${pull.base.repo.owner.login}/${pull.base.repo.name}/contents/${file.filename}`);
                    const content = Buffer.from(response.data.content, "base64").toString("utf8");
                    newFm = (0, front_matter_1.default)(content).attributes;
                }
                // Get and add labels
                let labels2add = yield getLabelsFromConfig(newFm, oldFm, config);
                for (let label of labels2add) {
                    labels.add(label);
                }
            });
        }));
        // Add labels
        octokit.rest.issues.addLabels({
            owner: repo.owner,
            repo: repo.repo,
            issue_number: pull === null || pull === void 0 ? void 0 : pull.number,
            labels: [...labels]
        });
        // Remove outdated labels
        for (let label of Object.keys(config)) {
            if (labels.has(label)) {
                continue;
            }
            octokit.rest.issues.removeLabel({
                owner: repo.owner,
                repo: repo.repo,
                issue_number: pull === null || pull === void 0 ? void 0 : pull.number,
                name: label
            });
        }
    });
}
run();

