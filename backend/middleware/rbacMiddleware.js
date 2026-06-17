const db = require("../config/db");

/**
 * Higher-order middleware for Role-Based Access Control (RBAC)
 * @param {string[]} allowedRoles Array of allowed roles, e.g., ['admin', 'faculty']
 */
function requireRoles(allowedRoles) {
  return async (req, res, next) => {
    const userUid = req.user?.uid;
    if (!userUid) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: Missing user authentication context."
      });
    }

    try {
      // Look up role if not already injected
      let role = req.user.role;
      if (!role) {
        const userRes = await db.query("SELECT role FROM users WHERE firebase_uid = $1 LIMIT 1", [userUid]);
        if (userRes.rows.length === 0) {
          return res.status(403).json({
            success: false,
            error: "Access Denied: User account not registered."
          });
        }
        role = userRes.rows[0].role;
        req.user.role = role;
      }

      if (!allowedRoles.includes(role)) {
        return res.status(403).json({
          success: false,
          error: `Access Denied: Requires one of the following roles: ${allowedRoles.join(", ")}`
        });
      }

      return next();
    } catch (error) {
      console.error("RBAC Middleware error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to verify access permissions.",
        details: error.message
      });
    }
  };
}

module.exports = { requireRoles };
