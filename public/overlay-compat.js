(function () {
  if (!Object.hasOwn) Object.hasOwn = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };
  function at(index) { var length = this.length, number = Number(index) || 0; number = number < 0 ? Math.ceil(number) : Math.floor(number); if (number < 0) number += length; return number >= 0 && number < length ? this[number] : undefined; }
  if (!Array.prototype.at) Object.defineProperty(Array.prototype, 'at', { value: at, configurable: true, writable: true });
  if (!String.prototype.at) Object.defineProperty(String.prototype, 'at', { value: at, configurable: true, writable: true });
  if (!Promise.withResolvers) Promise.withResolvers = function () { var resolve, reject; var promise = new Promise(function (yes, no) { resolve = yes; reject = no; }); return { promise: promise, resolve: resolve, reject: reject }; };
  if (!Promise.allSettled) Promise.allSettled = function (values) { return Promise.all(Array.from(values).map(function (value) { return Promise.resolve(value).then(function (result) { return {status:'fulfilled', value:result}; }, function (error) { return {status:'rejected', reason:error}; }); })); };
})();
