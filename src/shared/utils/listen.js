export function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    function cleanup() {
      server.off('error', onError);
      server.off('listening', onListening);
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    function onListening() {
      cleanup();
      resolve(server.address());
    }

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}
