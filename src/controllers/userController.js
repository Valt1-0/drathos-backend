const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const JWT_TOKEN = process.env.JWT_TOKEN || console.log("JWT_TOKEN not found");

// Register
exports.register = async (req, res) => {
  const { username, password } = req.body;

  console.log("Registering user: ", username);
  console.log("Password: ", password);

  try {
    let user = await User.findOne({ username });
    if (user) {
      return res.status(400).json({ msg: "User already exists" });
    }

    const usersCount = await User.countDocuments();
    const role = usersCount === 0 ? "admin" : "member";

    user = new User({
      username,
      password,
      role,
    });

    await user.save();

    const payload = {
      user: {
        id: user.id,
        username: user.username,
        profilePicture: user.profilePicture,
        role: user.role,
      },
    };

    jwt.sign(payload, JWT_TOKEN, { expiresIn: "30d" }, (err, token) => {
      if (err) throw err;
      res.json({ token, message: "User registered successfully" });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};

// Login
exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const payload = {
      user: {
        id: user.id,
        username: user.username,
        profilePicture: user.profilePicture,
        role: user.role,
      },
    };

    jwt.sign(payload, JWT_TOKEN, { expiresIn: "30d" }, (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
};
