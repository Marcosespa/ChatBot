import dotenv from "dotenv"

dotenv.config();

export default{
  WEBHOOK_VERIFY_TOKEN:process.env.WEBHOOK_VERIFY_TOKEN,
  API_TOKEN:process.env.API_TOKEN,
  PORT:process.env.PORT || 3000,
  BUSINESS_PHONE:process.env.BUSINESS_PHONE,
  API_VERSION:process.env.API_VERSION,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  BASE_URL:process.env.BASE_URL
}
