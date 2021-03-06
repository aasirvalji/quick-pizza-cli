#!/usr/bin/env node
const puppeteer = require("puppeteer");
const delay = require("./utils/delay");
const formatTime = require("./utils/formatTime");
const getHours = require("./utils/getHours");
const toppings = require("./toppings.json");
const toppingsMap = require("./toppingsMap.json");
const pizzaSizes = require("./pizzaSizes.json");
const provinces = require("./provinces.json");
const sauces = require("./sauces.json");
const readline = require("readline");
const chalk = require("chalk");
const log = console.log;

// ["-a", "-si?", "-sa?", "-t", "-n", "-e", "-p", "-i?", "-save?"];
// -a [address/req] -s [size/default: 12] -t [toppings/default: none] -n [name/req], -e [email/req], -p [phone number/req] -i [instructions/req] -save [save order/default: false]

// Get current time
var now = new Date();
var formattedTime = formatTime(now);
var numOfHours = getHours(formattedTime);

// Stores open from 11am - 12am
if (numOfHours < 11)
  return log("Stores seem to be closed, please try again later.");

// Declare values to be used in order and their defaults
var addressType = "House";
var addressStreet = "";
var addressSreetLineTwo = "";
var addressCity = "";
var addressProvince = "";
var addressPostalCode = "";

var selectedInches = 12; // [10, 12, 14, 16] / [small, medium, large, extra large]
var selectedSauce = ".c-topping-X";
var crust = `crust_type|${selectedInches}HANDTOSS`;
var userToppings = [];

var fullName = "";
var email = "";
var phoneNumber = "";
var instructions = "";

var userSizeInput = "m";
var userSauceInput = "pizza";

var rawArgs = process.argv.slice(2);
var argMap = {};
var currFlag = "";
for (var arg of rawArgs) {
  if (arg.includes("-")) {
    currFlag = arg;
    continue;
  } else if (!argMap[currFlag]) argMap[currFlag] = arg;
  else argMap[currFlag] = argMap[currFlag] + " " + arg;
}

for (var key in argMap) {
  switch (key) {
    case (key = "-a"):
      var splitArgs = argMap[key].split(",");
      for (var i = 0; i < splitArgs.length; i++) {
        splitArgs[i] = splitArgs[i].trim();
      }
      addressStreet = splitArgs[0];
      addressCity = splitArgs[1];
      addressProvince = provinces[splitArgs[2].toUpperCase()];
      addressPostalCode = splitArgs[3].toUpperCase();
      break;
    case (key = "-si"):
      userSizeInput = argMap[key].toLowerCase();
      if (!argMap[key].toLowerCase()) userSizeInput = "m";
      else if (!(userSizeInput in pizzaSizes)) {
        return log("Invalid pizza size entry");
      }
      break;
    case (key = "-sa"):
      userSauceInput = argMap[key].toLowerCase();
      if (!argMap[key].toLowerCase()) userSauceInput = "pizza";
      else if (!(userSauceInput in sauces)) {
        return log("Invalid pizza sauce entry");
      }
      break;
    case (key = "-t"):
      var splitArgs = argMap[key].split(",");
      for (var i = 0; i < splitArgs.length; i++) {
        splitArgs[i] = splitArgs[i].trim();
      }
      userToppings = splitArgs;
      break;
    case (key = "-n"):
      fullName = argMap[key];
      break;
    case (key = "-e"):
      email = argMap[key];
      break;
    case (key = "-p"):
      phoneNumber = argMap[key];
      break;
    case (key = "-i"):
      instructions = argMap[key];
      break;
    case (key = "-save"):
      // TODO: SAVE ORDER TO FILE
      break;
  }
}

// Set selected inches/sauce based on user input OR defaults if no user input
selectedInches = pizzaSizes[userSizeInput];
selectedSauce = sauces[userSauceInput];

// Check for empty values
if (!addressStreet || !addressCity || !addressProvince || !addressPostalCode)
  return log("Missing fields from address.");

if (!fullName || !email || !phoneNumber)
  return log("Missing personal information.");

if (phoneNumber.length !== 10 || !/^\d+$/.test(phoneNumber))
  return log("Invalid phone number format.");

if (userToppings.length === 0) return log("Toppings missing.");

// Create toppings string if it exists
var userToppingsStr = "";
if (userToppings.length > 0) {
  for (var topping of userToppings) {
    if (topping in toppingsMap) userToppingsStr += `${toppingsMap[topping]}, `;
  }
  userToppingsStr = userToppingsStr.substring(0, userToppingsStr.length - 2); // remove extra ', '
}

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

log(chalk.blue("\nWelcome to ") + chalk.bold("quick-pizza."));
log(
  chalk.red(`
  ----------------  
|   *           *  |
|           *      |
|      *           |
|  *            *  |
|      *    *      |
|  *               |
|       *      *   |
  ----------------  
`)
);

// Prompt user for input
rl.question(
  chalk.white(`Your order:
Street Address: ${addressStreet}
City: ${addressCity}
Province: ${addressProvince}
Postal Code: ${addressPostalCode}
Full Name: ${fullName}
Email: ${email}
Phone Number: ${phoneNumber}
Instructions: ${instructions}
Toppings: ${userToppingsStr ? userToppingsStr : "No toppings selected"}
Pizza size: ${userSizeInput.toUpperCase()} (${selectedInches}")
Pizza sauce: ${userSauceInput}
Is this correct? [y/n]: `),
  function (input) {
    input = input.toLowerCase();
    if (input !== "n" && input !== "no" && input !== "y" && input && "yes") {
      log("Invalid input.");
      process.exit(0);
    }

    if (input === "n" || input === "no") {
      log("Exiting...");
      process.exit(0);
    }

    (async () => {
      log(chalk.yellow("Starting headless browser"));

      // Launch browser
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();

      // Go to order pizza page. This will redirect to a location prompt page.
      await Promise.all([
        page.goto(
          "https://www.dominos.ca/en/pages/order/#!/product/S_PIZZA/builder/?skipCustomize=true"
        ),
        page.waitForNavigation({ waitUntil: "networkidle2" }),
      ]);

      log(chalk.yellow("Entering your address details"));
      // Enter location params
      await page.click(".circ-icons__txt");
      await page.select("#Address_Type_Select", addressType);
      await page.type("#Street", addressStreet);
      await page.type("#Address_Line_2", addressSreetLineTwo); // Optional
      await page.type("#City", addressCity);
      await page.select("#Region", addressProvince);
      await page.type("#Postal_Code", addressPostalCode);

      // Submit location and go to pizza options page
      await Promise.all([
        page.click('[type="submit"]'),
        page.waitForNavigation({ waitUntil: "networkidle2" }),
      ]);

      // wait for page loading animation to finish
      await delay(5000);
      await page.select(".select--future-time", "my-value");

      log(chalk.yellow("Selecting your pizza size"));
      // Set pizza size (Radio select)
      await page.click(`[data-quid="pizza-size-${selectedInches}"]`);
      await page.click(`[for="${crust}"]`);

      // Submit size & crust, go to chesse and sauces
      await Promise.all([page.click('[data-quid="pizza-builder-next-btn"]')]);

      // Wait for page loading animation to finish
      await delay(2000);

      log(chalk.yellow("Selecting your sauce"));
      // Set pizza sauce (Radio select)
      await page.click(selectedSauce);
      // [Pizza Sauce, BBQ Sauce*, Alfredo Sauce*, Hearty Marinara Sauce*, Ranch Dressing*]
      // [.c-topping-X, .c-topping-Q, .c-topping-Xf, .c-topping-Xm, .c-topping-Rd]

      // Submit pizza sauce, go to toppings
      await Promise.all([page.click('[data-quid="pizza-builder-next-btn"]')]);

      // Select no thanks for extra cheese
      await page.waitForSelector('[data-quid="builder-no-step-upsell"]');
      await delay(1000);
      await Promise.all([page.click('[data-quid="builder-no-step-upsell"]')]);

      log(chalk.yellow("Selecting your toppings"));
      var numberOfToppings = userToppings.length;
      userToppings.forEach((t, index) => {
        setTimeout(async () => {
          var toppingSelector = toppings[toppingsMap[t]];
          if (!toppingSelector) {
            for (var key in toppings) {
              if (key.substring(0, key.length - 1) === toppingsMap[t]) {
                toppingSelector = toppings[key];
                break;
              }
            }
            if (!toppingSelector) {
              log("Invalid topping. Terminating...");
              process.exit(0);
            }
          }

          await page.waitForSelector(`[name="${toppingSelector}"]`);
          await Promise.all([page.click(`[name="${toppingSelector}"]`)]);

          if (index === numberOfToppings - 1) {
            await page.click('[data-quid="add-pizzabuilder-button"]');

            // await page.waitForSelector(".nav__group--cart");
            // await page.click(".nav__group--cart");
            await page.goto(
              "https://www.dominos.ca/en/pages/order/#!/checkout/"
            );

            await page.waitForSelector(".js-closeButton");
            await delay(1000);
            await page.click(".js-closeButton");

            await page.waitForSelector('[data-quid="continue-checkout-btn"]');
            await page.click('[data-quid="continue-checkout-btn"]');

            log(chalk.yellow("Entering your contact information"));
            await delay(1000);
            await page.waitForSelector("#First_Name");
            await page.type("#First_Name", fullName.split(" ")[0]);
            await page.waitForSelector("#Last_Name");
            await page.type("#Last_Name", fullName.split(" ")[1]);
            await page.waitForSelector("#Email");
            await page.type("#Email", email);
            await delay(1000);
            await page.waitForSelector("#Callback_Phone");
            await page.evaluate((text) => {
              document.getElementById("Callback_Phone").value = text;
            }, phoneNumber);

            instructions &&
              log(chalk.yellow("Entering your delivery instructions"));
            await page.waitForSelector("#Delivery_Instructions");
            await page.type("#Delivery_Instructions", instructions);
            // await page.waitForSelector('[data-quid="payment-door-credit"]'); pay with credit/debit upon delivery
            // await page.click('[data-quid="payment-door-credit"]');
            await page.waitForSelector('[data-quid="payment-cash"]'); // pay with cash upon delivery
            await page.click('[data-quid="payment-cash"]');

            var deliveryTime = await page.$eval(
              ".order-complete-time__text",
              (el) => el.innerText
            );

            log(
              chalk.blue(
                "After you place your order, it should be delivered between "
              ) + chalk.bold(deliveryTime)
            );

            // [UNCOMMENT THE LINE BELOW TO SUBMIT YOUR ORDER WHEN USING THE CLI]: Submit order
            // await page.click('[data-quid="payment-order-now"]');

            // Log success and terminate
            log(chalk.yellow("Order placed"));
            log(
              "Terminating in 10 seconds. Thank you for using the quick-pizza cli."
            );
            await delay(10000);
            process.exit(0);
          }
        }, index * 1000);
      });
    })();
  }
);
