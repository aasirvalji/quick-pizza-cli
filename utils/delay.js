module.exports = (time) => {
  console.log(`Timing out for ${time / 1000} seconds.`);
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
};
