// Texas permit parser for extracting route waypoints from TxDMV permits
// Parses the route table and returns a list of waypoints for Google Maps

function parseTexasPermit(text) {
    // Find the route table section
    const routeTableRegex = /Miles\s+Route\s+To\s+Distance[\s\S]+?Final Destination: ([\s\S]+?)(?:\n|$)/;
    const tableMatch = text.match(routeTableRegex);
    if (!tableMatch) return null;

    // Extract each line of the route table
    const lines = tableMatch[0].split('\n').filter(l => l.trim().length > 0);
    // Skip header lines, find lines with actual route steps
    const routeLines = lines.filter(l => /\d+\.\d+/.test(l));

    // Parse waypoints from each line
    const waypoints = [];
    for (const line of routeLines) {
        // Example line: "3.00 IH30 W Take Exit 220A toward US-59 ATLANTA & HOUSTON (WHATLEY TX) to NASH TX 3.00 00:03"
        // Extract the 'To' field (destination/city/highway)
        const parts = line.split(/\s{2,}|\t/).filter(Boolean);
        // Fallback: split by spaces if tabular split fails
        if (parts.length < 4) {
            const fallbackParts = line.split(/\s+/);
            // Find the 'To' field (after Route)
            if (fallbackParts.length > 2) {
                waypoints.push(fallbackParts.slice(2, fallbackParts.length - 2).join(' '));
            }
        } else {
            waypoints.push(parts[2]);
        }
    }

    // Clean up waypoints (remove extra info, keep city/highway names)
    const cleaned = waypoints.map(wp => {
        // Remove parentheticals and extra details
        return wp.replace(/\(.*?\)/g, '').replace(/to /i, '').trim();
    }).filter(Boolean);

    // Add origin and final destination
    const originMatch = text.match(/Origin: ([^\n]+)/);
    const destMatch = text.match(/Final Destination: ([^\n]+)/);
    if (originMatch) cleaned.unshift(originMatch[1].trim());
    if (destMatch) cleaned.push(destMatch[1].trim());

    return cleaned;
}

module.exports = { parseTexasPermit };
