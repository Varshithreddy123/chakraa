require("dotenv").config();
import { NextFunction, Request, Response } from "express";
import twilio from "twilio";
import prisma from "../utils/prisma";
import jwt from "jsonwebtoken";
import { nylas } from "../app";
import { sendToken } from "../utils/send-token";
import { formatAndValidatePhone } from "../utils/phone.utils";
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken, {
  lazyLoading: true,
});

// register new user
export const registerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let { phone_number } = req.body;
    const formatted_phone = formatAndValidatePhone(phone_number);
    console.log('registerUser formatted phone:', formatted_phone);
    await client.verify.v2
      ?.services(process.env.TWILIO_SERVICE_SID!)
      .verifications.create({
        channel: "sms",
        to: formatted_phone,
      });

    res.status(201).json({
      success: true,
    });
  } catch (error: any) {
    console.log("TWILIO ERROR:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Invalid phone number format. Use 10 digits e.g. 9876543210",
    });
  }
};

// verify otp
export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let { phone_number, otp } = req.body;
    const formatted_phone = formatAndValidatePhone(phone_number);
    console.log('verifyOtp formatted phone:', formatted_phone);

    await client.verify.v2
      .services(process.env.TWILIO_SERVICE_SID!)
      .verificationChecks.create({
        to: formatted_phone,
        code: otp,
      });
    // is user exist
    const isUserExist = await prisma.user.findUnique({
      where: {
        phone_number: formatted_phone,
      },
    });
    if (isUserExist) {
      await sendToken(isUserExist, res);
    } else {
      // create account
      const user = await prisma.user.create({
        data: {
          phone_number: formatted_phone,
        },
      });
      res.status(200).json({
        success: true,
        message: "OTP verified successfully!",
        user: user,
      });
    }
  } catch (error: any) {
    console.log("VERIFY OTP ERROR:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Invalid OTP or phone number",
    });
  }
};

// sending otp to email
export const sendingOtpToEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, name, userId } = req.body;

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const user = {
      userId,
      name,
      email,
    };
    const token = jwt.sign(
      {
        user,
        otp,
      },
      process.env.EMAIL_ACTIVATION_SECRET!,
      {
        expiresIn: "5m",
      }
    );
    try {
      await nylas.messages.send({
        identifier: process.env.USER_GRANT_ID!,
        requestBody: {
          to: [{ name: name, email: email }],
          subject: "Verify your email address!",
          body: `
          <p>Hi ${name},</p>
      <p>Your Chaakra verification code is ${otp}. If you didn't request for this OTP, please ignore this email!</p>
      <p>Thanks,<br>Chaakra Team</p>
          `,
        },
      });
      res.status(201).json({
        success: true,
        token,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      console.log(error);
    }
  } catch (error) {
    console.log(error);
  }
};

// verifying email otp
export const verifyingEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { otp, token } = req.body;

    const newUser: any = jwt.verify(
      token,
      process.env.EMAIL_ACTIVATION_SECRET!
    );

    if (newUser.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "OTP is not correct or expired!",
      });
    }

    const { name, email, userId } = newUser.user;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    if (user?.email === null) {
      const updatedUser = await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          name: name,
          email: email,
        },
      });
      await sendToken(updatedUser, res);
    }
  } catch (error) {
    console.log(error);
    res.status(400).json({
      success: false,
      message: "Your otp is expired!",
    });
  }
};

// get logged in user data
export const getLoggedInUserData = async (req: any, res: Response) => {
  try {
    const user = req.user;

    res.status(201).json({
      success: true,
      user,
    });
  } catch (error) {
    console.log(error);
  }
};

// getting user rides
export const getAllRides = async (req: any, res: Response) => {
  const rides = await prisma.rides.findMany({
    where: {
      userId: req.user?.id,
    },
    include: {
      driver: true,
      user: true,
    },
  });
  res.status(201).json({
    rides,
  });
};