const myPromise = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve("Operation successful!"); // Fulfilled after 2 seconds
  }, 5000);
});

myPromise.then((result) => {
  console.log(result); // Prints "Operation successful!" after 2 seconds
}).catch((error) => {
  console.log(error); // Handles any errors
});
