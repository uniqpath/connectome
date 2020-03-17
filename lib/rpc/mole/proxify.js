function proxify(moleClient) {
  const callMethodProxy = proxifyOwnMethod(moleClient.callMethod.bind(moleClient));
  const notifyProxy = proxifyOwnMethod(moleClient.notify.bind(moleClient));

  return new Proxy(moleClient, {
    get(target, methodName) {
      if (methodName === 'notify') {
        return notifyProxy;
      }

      if (methodName === 'callMethod') {
        return callMethodProxy;
      }

      if (methodName === 'then') {
        // without this you will not be able to return client from an async function.
        // V8 will see then method and will decide that client is a promise
        return;
      }

      if (methodName === 'setMethodPrefix') {
        return (...params) => moleClient.setMethodPrefix(params);
      }

      return (...params) => target.callMethod.call(target, methodName, params);
    }
  });
}

function proxifyOwnMethod(ownMethod) {
  return new Proxy(ownMethod, {
    get(target, methodName) {
      return (...params) => target.call(null, methodName, params);
    },
    apply(target, _, args) {
      return target.apply(null, args);
    }
  });
}

export default proxify;
