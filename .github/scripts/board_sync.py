"""Keep the issues of this repository and GitHub Project 4 (Status field) in step.

Two directions:
  event:    an issue opened, closed, reopened or labeled -> add it to the project and set Status from it.
            closed = Done; otherwise the label todo / in-progress / done; no label = To do.
  schedule: Status on the project -> labels (and open/closed) on the issues, so moves made on the
            board or in Nebula World show up on the issues too.

Tokens: PROJECT_TOKEN (classic, scope "project") for the project; GITHUB_TOKEN for labels and issue state.
Standard library only. Neither token is ever printed.
"""
import json
import os
import sys
import urllib.request

API = "https://api.github.com"
OWNER = os.environ.get("BOARD_OWNER", "heiderdamaseno")
NUMBER = int(os.environ.get("BOARD_NUMBER", "4"))
REPO = os.environ.get("GITHUB_REPOSITORY", "heiderdamaseno/heidersouza.com")
LABELS = {"todo": "todo", "in-progress": "in-progress", "done": "done"}


def key(name):
    """Map a Status option name or a label to todo / in-progress / done."""
    n = "".join(ch for ch in (name or "").lower() if ch.isalnum())
    if n in ("todo", "backlog", "new"):
        return "todo"
    if n in ("inprogress", "doing", "inreview"):
        return "in-progress"
    if n in ("done", "closed", "complete", "completed"):
        return "done"
    return None


def call(method, url, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
        "Content-Type": "application/json", "User-Agent": "heidersouza-board-sync"})
    with urllib.request.urlopen(req, timeout=20) as r:
        raw = r.read()
    return json.loads(raw) if raw else {}


def graphql(token, query, variables):
    answer = call("POST", API + "/graphql", token, {"query": query, "variables": variables})
    if answer.get("errors"):
        raise RuntimeError("GitHub GraphQL refused: " + "; ".join(e.get("message", "?") for e in answer["errors"]))
    return answer["data"]


PROJECT = """query($owner:String!,$number:Int!,$after:String){user(login:$owner){projectV2(number:$number){id
 field(name:"Status"){... on ProjectV2SingleSelectField{id options{id name}}}
 items(first:100,after:$after){pageInfo{hasNextPage endCursor} nodes{id fieldValueByName(name:"Status"){... on ProjectV2ItemFieldSingleSelectValue{name}}
  content{... on Issue{id number state repository{nameWithOwner} labels(first:20){nodes{name}}}}}}}}}"""


def project(token):
    items, after, proj = [], None, None
    while True:
        data = graphql(token, PROJECT, {"owner": OWNER, "number": NUMBER, "after": after})
        proj = data["user"]["projectV2"]
        page = proj["items"]
        items += page["nodes"]
        if not page["pageInfo"]["hasNextPage"]:
            break
        after = page["pageInfo"]["endCursor"]
    field = proj["field"] or {}
    options = {key(o["name"]): o["id"] for o in field.get("options", []) if key(o["name"])}
    missing = {"todo", "in-progress", "done"} - set(options)
    if missing:
        raise RuntimeError("Project Status needs options for: " + ", ".join(sorted(missing)))
    return proj["id"], field["id"], options, items


def wanted_from_issue(issue, changed_label=None):
    if issue["state"] == "closed":
        return "done"
    if changed_label and key(changed_label) in ("todo", "in-progress"):
        return key(changed_label)
    names = [key(l["name"]) for l in issue.get("labels", [])]
    for k in ("in-progress", "todo"):
        if k in names:
            return k
    return "todo"


def set_labels(gh, number, current, target):
    """Leave exactly one status label on the issue (target), keep every other label."""
    base = f"{API}/repos/{REPO}/issues/{number}"
    for name in current:
        if key(name) and name != LABELS[target]:
            try:
                call("DELETE", f"{base}/labels/{urllib.request.quote(name)}", gh)
            except Exception:
                pass
    if LABELS[target] not in current:
        call("POST", f"{base}/labels", gh, {"labels": [LABELS[target]]})


def on_event(pt, gh):
    event = json.load(open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8"))
    issue, action = event["issue"], event.get("action")
    changed = (event.get("label") or {}).get("name") if action == "labeled" else None
    if action == "labeled" and not key(changed):
        return "label is not a status label; nothing to do"
    target = wanted_from_issue(issue, changed)
    if action == "labeled" and key(changed) == "done" and issue["state"] != "closed":
        call("PATCH", f"{API}/repos/{REPO}/issues/{issue['number']}", gh, {"state": "closed", "state_reason": "completed"})
        target = "done"
    if action == "reopened" and target == "done":
        target = "todo"
    project_id, field_id, options, items = project(pt)
    item = next((i["id"] for i in items if (i.get("content") or {}).get("number") == issue["number"]
                 and i["content"]["repository"]["nameWithOwner"] == REPO), None)
    if not item:
        item = graphql(pt, "mutation($p:ID!,$c:ID!){addProjectV2ItemById(input:{projectId:$p,contentId:$c}){item{id}}}",
                       {"p": project_id, "c": issue["node_id"]})["addProjectV2ItemById"]["item"]["id"]
    graphql(pt, """mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,
      value:{singleSelectOptionId:$o}}){projectV2Item{id}}}""", {"p": project_id, "i": item, "f": field_id, "o": options[target]})
    set_labels(gh, issue["number"], [l["name"] for l in issue.get("labels", [])], target)
    return f"#{issue['number']} -> {target}"


def on_schedule(pt, gh):
    project_id, field_id, options, items = project(pt)
    done = []
    for i in items:
        c = i.get("content") or {}
        if not c.get("number") or c["repository"]["nameWithOwner"] != REPO:
            continue
        status = key((i.get("fieldValueByName") or {}).get("name"))
        if not status:
            continue
        labels = [l["name"] for l in c["labels"]["nodes"]]
        state = c["state"].lower()
        if status == "done" and state != "closed":
            call("PATCH", f"{API}/repos/{REPO}/issues/{c['number']}", gh, {"state": "closed", "state_reason": "completed"})
        elif status != "done" and state == "closed":
            call("PATCH", f"{API}/repos/{REPO}/issues/{c['number']}", gh, {"state": "open"})
        if [n for n in labels if key(n)] != [LABELS[status]]:
            set_labels(gh, c["number"], labels, status)
            done.append(f"#{c['number']} -> {status}")
    return ", ".join(done) or "everything already in step"


def main():
    pt, gh = os.environ.get("PROJECT_TOKEN", ""), os.environ.get("GITHUB_TOKEN", "")
    if not pt:
        print("PROJECT_TOKEN secret is not set; nothing synced.")
        return 0
    if os.environ.get("GITHUB_EVENT_NAME") == "issues":
        print(on_event(pt, gh))
    else:
        print(on_schedule(pt, gh))
    return 0


if __name__ == "__main__":
    sys.exit(main())
