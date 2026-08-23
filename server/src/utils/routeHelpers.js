/**
 * Wraps an async route handler so a rejected promise reaches Express's error handler.
 *
 * Express 4 does not await handlers, so without this a thrown error becomes an unhandled rejection
 * and the client is left hanging until it times out.
 */
function asyncRoute(handler) {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}

module.exports = { asyncRoute };
