const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

require("dotenv").config();

mongoose.connect(`${process.env.mongo_url}`, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => console.log("Connected to MongoDB"));

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  mobileNumber: String,
  email: String,
  password: String,
  cart: [
    {
      productId: mongoose.Schema.Types.ObjectId,
      productName: String,
      price: Number,
      quantity: { type: Number, default: 1 },
    },
  ],
  totalAmount: { type: Number, default: 0 },
  address: {
    country: { type: String },
    state: { type: String },
    city: { type: String },
    pinCode: { type: String, minlength: 6, maxlength: 6 },
    street: String,
  },
});

const User = mongoose.model("User", userSchema);

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const se = process.env.sec;

app.use(
  session({
    secret: "${se}",
    resave: false,
    saveUninitialized: true,
  })
);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000);
}

async function sendOTP(email, otp) {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: `${process.env.myEmail}`,
      pass: `${process.env.myLaile}`,
    },
  });

  const mailOptions = {
    from: `${process.env.myEmail}`,
    to: email,
    subject: "OTP Verification For NavBazaar",
    html: `<h3>Welcome to NavBazaar</h3><br/><p>Your OTP for email verification is: <strong>${otp}</strong></p><br/><h4>Delivered by Vedant Patel</h4>`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending OTP:", error);
  }
}

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

const pinc = process.env.dpin;

app.post("/auth/signup", async (req, res) => {
  const { firstName, lastName, mobileNo, email, password, confirmPassword } =
    req.body;
  const otp = generateOTP();
  if (
    !firstName ||
    !lastName ||
    !mobileNo ||
    !email ||
    !password ||
    !confirmPassword
  ) {
    return res.redirect("/error/400");
  }

  if (password !== confirmPassword) {
    return res.redirect("/error/4002");
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.redirect("/error/4003");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const ddp = pinc;
    const newUser = new User({
      firstName,
      lastName,
      mobileNumber: mobileNo,
      email,
      password: hashedPassword,
      cart: [],
      totalAmount: 0,
      address: { pinCode: ddp },
    });
    req.session.otp = otp;
    await newUser.save();
    await sendOTP(email, otp);
    req.session.email = email;

    res.redirect("/otpveri");
  } catch (error) {
    console.error("Error creating user:", error);
    return res.redirect("/error/500");
  }
});

app.get("/otpveri", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "otpveri.html"));
});

app.post("/otp_verification", (req, res) => {
  const { email, otp } = req.body;

  if (otp == req.session.otp) {
    res.redirect("/home");
  } else {
    return res.redirect("/error/otp_invalid");
  }
});

app.get("/error/otp_invalid", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "error", "otp_invalid.html"));
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user) {
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (passwordMatch) {
        req.session.email = email;
        return res.redirect("/home");
      }
    }

    return res.redirect("/error/401");
  } catch (error) {
    console.error("Error logging in:", error);
    return res.redirect("/error/500");
  }
});

app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});
app.get("/prod1", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "prod1.html"));
});
app.get("/prod2", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "prod2.html"));
});
app.get("/prod3", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "prod3.html"));
});
app.get("/prod4", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "prod4.html"));
});
app.get("/prod5", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "prod5.html"));
});
app.get("/prod6", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "prod6.html"));
});
app.get("/profile", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "profile.html"));
});
app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "about.html"));
});

app.post("/add-to-cart", async (req, res) => {
  const { productId, productName, price } = req.body;

  try {
    const userEmail = req.session.email;

    const user = await User.findOne({ email: userEmail });

    if (user) {
      const existingProductIndex = user.cart.findIndex(
        (item) => item.productId === productId
      );

      if (existingProductIndex !== -1) {
        user.cart[existingProductIndex].quantity += 1;
      } else {
        user.cart.push({
          productId,
          productName,
          price,
          quantity: 1,
        });
      }

      user.totalAmount += Number(price);

      await user.save();

      res.redirect("/profile");
    } else {
      return res.redirect("/error/404");
    }
  } catch (error) {
    console.error("Error adding product to cart:", error);
    return res.redirect("/error/500");
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.redirect("/error/500");
    }
    res.redirect("/login");
  });
});

app.get("/user/profile", async (req, res) => {
  try {
    const userEmail = req.session.email;
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.redirect("/error/404");
    }
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return res.redirect("/error/500");
  }
});

app.get("/checkout", async (req, res) => {
  try {
    const userEmail = req.session.email;
    const user = await User.findOne({ email: userEmail });
    const dp = pinc;
    if (user.address.pinCode == dp) {
      res.sendFile(path.join(__dirname, "public", "checkout.html"));
    } else {
      res.redirect("/order_confirmation");
    }
  } catch (error) {
    console.error("Error fetching user data:", error);
    return res.redirect("/error/500");
  }
});

app.post("/checkout", async (req, res) => {
  const { email, country, state, city, pinCode, street } = req.body;

  try {
    const userEmail = req.session.email;
    const user = await User.findOne({ email: userEmail });

    if (user) {
      user.address = { country, state, city, pinCode, street };
      await user.save();
      res.redirect("/order_confirmation");
    } else {
      return res.redirect("/error/404");
    }
  } catch (error) {
    console.error("Error saving address:", error);
    return res.redirect("/error/500");
  }
});

app.get("/order_confirmation", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "confirmation.html"));
});

// app.get("/order_confirmation", (req, res) => {
//
//   const userEmail = req.session.email;

//
//   if (!userEmail) {
//     // Redirect to login page if email is not available
//     return res.redirect("/login");
//   }

//
//   User.findOne({ email: userEmail })
//     .then((user) => {
//       if (!user) {
//
//         return res.redirect("/login");
//       }

//
//       const totalAmount = user.totalAmount || 0;

//
//       res.render("order_confirmation", {
//         successMessage: "Items ordered successfully!",
//         orderList: user.cart,
//         totalAmount: totalAmount,
//       });
//     })
//     .catch((err) => {
//       console.error("Error fetching user cart:", err);
//       res.status(500).send("Server error");
//     });
// });

app.get("/order/details", async (req, res) => {
  try {
    const userEmail = req.session.email;
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      return res.redirect("/error/404");
    }

    res.status(200).json(user.cart);
  } catch (error) {
    console.error("Error fetching user cart:", error);
    return res.redirect("/error/500");
  }
});

app.get("/error/401", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "error", "401.html"));
});
app.get("/error/400", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "error", "400.html"));
});
app.get("/error/404", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "error", "404.html"));
});
app.get("/error/500", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "error", "500.html"));
});
app.get("/error/4002", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "error", "4002.html"));
});
app.get("/error/4003", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "error", "4003.html"));
});

app.post("/delete", async (req, res) => {
  try {
    const userEmail = req.session.email;

    await User.findOneAndDelete({ email: userEmail });

    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.redirect("/error/500");
      }
      res.redirect("/login");
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.redirect("/error/500");
  }
});

app.post("/empty-cart", async (req, res) => {
  try {
    const userEmail = req.session.email;

    await User.findOneAndUpdate(
      { email: userEmail },
      { cart: [], totalAmount: 0 }
    );

    res.redirect("/profile");
  } catch (error) {
    console.error("Error emptying cart:", error);
    return res.redirect("/error/500");
  }
});

const PORT = process.env.port || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
