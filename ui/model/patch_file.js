
function PatchFile(patchset, name)
{
    this.name = name || "";
    this.status = "";
    this.chunks = 0;
    this.missingBaseFile = false;
    this.propertyChanges = "";
    this.added = 0;
    this.removed = 0;
    this.id = 0;
    this.patchset = patchset || null; // PatchSet
    this.isBinary = false;
    this.messages = {}; // Map<line number, Array<PatchFileMessage>>
    this.messageCount = 0;
    this.drafts = [];
}

PatchFile.DRAFT_URL = "/{1}/patch/{2}/{3}?column_width=2000";
PatchFile.REVIEW_URL = "/{1}/diff/{2}/{3}";
PatchFile.DIFF_URL = "/download/issue{1}_{2}_{3}.diff";

PatchFile.prototype.parseData = function(data)
{
    this.status = data.status || "";
    this.chunks = data.num_chunks || 0;
    this.missingBaseFile = data.no_base_file || false;
    this.propertyChanges = data.property_changes || "";
    this.added = data.num_added || 0;
    this.removed = data.num_removed || 0;
    this.id = data.id || 0;
    this.isBinary = data.is_binary || false;

    var self = this;
    (data.messages || []).forEach(function(messageData) {
        var message = new PatchFileMessage();
        message.parseData(messageData);
        if (!self.messages[message.line])
            self.messages[message.line] = [];
        self.messages[message.line].push(message);
        self.messageCount++;
    });

    Object.each(this.messages, function(line, messages) {
        messages.sort(function(messageA, messageB) {
            return messageA.date - messageB.date;
        });
    });
};

PatchFile.prototype.getReviewUrl = function()
{
    // We don't uri encode the name since it's part of the url path.
    return PatchFile.REVIEW_URL.assign(
        encodeURIComponent(this.patchset.issue.id),
        encodeURIComponent(this.patchset.id),
        this.name);
};

PatchFile.prototype.getDraftsUrl = function()
{
    return PatchFile.DRAFT_URL.assign(
        encodeURIComponent(this.patchset.issue.id),
        encodeURIComponent(this.patchset.id),
        encodeURIComponent(this.id));
};

PatchFile.prototype.getDiffUrl = function()
{
    return PatchFile.DIFF_URL.assign(
        encodeURIComponent(this.patchset.issue.id),
        encodeURIComponent(this.patchset.id),
        encodeURIComponent(this.id));
};

PatchFile.prototype.loadDrafts = function()
{
    var patchFile = this;
    return loadDocument(this.getDraftsUrl()).then(function(document) {
        patchFile.parseDraftsDocument(document);
        return patchFile;
    });
};

PatchFile.prototype.loadDiff = function()
{
    var file = this;
    return loadText(this.getDiffUrl()).then(function(text) {
        var parser = new DiffParser(text);
        var result = parser.parse();
        if (result[0] && result[0].name == file.name)
            return result[0];
        throw new Error("No diff available");
    });
};

PatchFile.prototype.parseDraftsDocument = function(document)
{
    this.drafts = [];

    var nodes = document.querySelectorAll(".comment-border");

    for (var i = 0; i < nodes.length; ++i) {
        var node = nodes[i];

        var title = node.querySelector(".inline-comment-title b");
        var parentId = node.parentNode.id;
        var text = node.querySelector(".comment-text");

        if (!title || !parentId || !text)
            continue;

        var from = title.textContent;
        if (from !== "(Draft)")
            continue;

        var idParts = parentId.split("-");

        var message = new PatchFileMessage();
        message.author = User.forName("me");
        message.text = text.textContent;
        message.draft = true;
        message.line = Number(idParts[2]) || 0;
        message.date = Date.utc.create(title.nextSibling.textContent.trim());
        message.left = (idParts[0] === "old");

        this.drafts.push(message);
    }
};
