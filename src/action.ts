import core from '@actions/core';
import github from '@actions/github';
import fm from "front-matter";
import { parse } from 'yaml';

function isConditionMet(templateString : string, templateVars : any) : boolean {
    return new Function(`return ${templateString};`).call(templateVars); // Magic
}

async function getLabelsFromConfig(newFm: any, oldFm: any, config: { [key: string]: string; }) : Promise<string[]> {
    let result = new Set<string>();
    let context = {
        "new": newFm,
        "old": oldFm
    }
    for (let label in config) {
        if (isConditionMet(config[label], context)) {
            result.add(label);
        }
    }
    return [...result];
}

async function run() {
    // Initialize GitHub API
    const GITHUB_TOKEN = core.getInput('token');
    const octokit = github.getOctokit(GITHUB_TOKEN);

    // Deconstruct the payload
    const { context } = github;
    const { payload } = context;
    const { repository, pull_request } = payload;

    // Parse config file
    const response = await octokit.request(`GET /repos/${repository?.owner.login}/${repository?.name}/contents/.jekyll-labels.yml`);
    if (response.status !== 200) {
        core.setFailed('Could not find .jekyll-labels.yml');
        process.exit(1);
    }
    const config = parse(Buffer.from(response.data.content, "base64").toString("utf8")) as { [key: string]: string; };

    // Initialize labels
    const labels = new Set<string>();

    // Iterate through changed files
    const fetched = await octokit.paginate(octokit.rest.pulls.listFiles, {
        owner: pull_request?.base.repo.owner.login,
        repo: pull_request?.base.repo.name,
        pull_number: pull_request?.number as number,
    });

    // Be awed by the speed of doing everything in parallel
    await Promise.all(fetched.map(async function(file) {
        if (!file.filename.endsWith(".md")) {
            return; // Jekyll only renders markdown files
        }

        if (file.status !== "modified" && file.status !== "added" && file.status !== "removed") {
            return; // File unmodified
        }
        
        let newFm = {} as any;
        let oldFm = {} as any;

        if (file.status === "removed" || file.status === "modified") {
            const response = await octokit.request(`GET /repos/${repository?.owner.login}/${repository?.name}/contents/${file.filename}?ref=${pull_request?.head.sha}`);
            const content = Buffer.from(response.data.content, "base64").toString("utf8");
            oldFm = fm(content).attributes as any;
        }

        if (file.status === "added" || file.status === "modified") {
            const response = await octokit.request(`GET /repos/${pull_request?.base.repo.owner.login}/${pull_request?.base.repo.name}/contents/${file.filename}`);
            const content = Buffer.from(response.data.content, "base64").toString("utf8");
            newFm = fm(content).attributes as any;
        }

        // Get and add labels
        let labels2add = await getLabelsFromConfig(newFm, oldFm, config);
        for (let label of labels2add) {
            labels.add(label);
        }
    }));

    // Add labels
    octokit.rest.issues.addLabels({
        owner: repository?.owner.login as string,
        repo: repository?.name as string,
        issue_number: pull_request?.number as number,
        labels: [...labels]
    });

    // Remove outdated labels
    for (let label of Object.keys(config)) {
        if (labels.has(label)) {
            continue;
        }
        octokit.rest.issues.removeLabel({
            owner: repository?.owner.login as string,
            repo: repository?.name as string,
            issue_number: pull_request?.number as number,
            name: label
        });
    }
}

run();
