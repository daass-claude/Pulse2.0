export const GRATITUDE_PROMPTS = [
  "The Perfect Tool: What is one physical object you own that works exactly as it's supposed to and makes your life better?",
  "The Soundtrack: What is a song or artist that always shifts your mood for the better?",
  "The Unsung Hero: Who is someone in your life who makes your day easier without ever asking for credit?",
  "The Luxury of Choice: What is one \"chore\" you have to do that is actually a result of a privilege you have?",
  "The Laugh: Who is the person in your life who makes you laugh the hardest?",
  "The Childhood Spark: What is a hobby or interest from your childhood that still brings a smile to your face today?",
  "The Senses: Describe one specific sound, smell, or texture that makes you feel peaceful.",
  "The Comfort Meal: What is your go-to meal that feels like a hug in a bowl?",
  "The Weather: Regardless of the forecast, what is one thing you appreciate about the weather today?",
  "The Growth Spurt: What is a personality trait you've developed in the past years that you really like about yourself?",
  "The Daily Essential: What is one physical object you use every day that makes your life significantly easier?",
  "The Morning Routine: What is your favorite part of your morning before you even get to work?",
  "The Teacher: Who is someone (famous or personal) whose wisdom has changed the way you look at the world?",
  "The Office Perk: What is your favorite small thing about this team?",
  "The History: What is a tradition (family or personal) that you are most thankful for?",
  "The Comfort Zone: What is the most comfortable piece of clothing you own?",
  "The Tech Assist: What is a specific app or piece of software that genuinely adds value to your life?",
  "The Old Connection: Who is someone you haven't talked to in a while, but you're still grateful for?",
  "The Observation: What is one thing you used to take for granted that you now cherish?",
  "The Mentorship: Who is a teacher or mentor from your school days you'd love to thank?",
  "The Night Owl/Early Bird: What is your favorite time of day and why?",
  "The Space: What is a luxury in your daily routine that you often overlook?",
  "The Simple Joy: What is the smallest thing that happened recently that brought you genuine happiness?",
];

function utcDayOfYear(): number {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

export function getDailyGratitudePrompt(): string {
  return GRATITUDE_PROMPTS[utcDayOfYear() % GRATITUDE_PROMPTS.length];
}

export function getDailyDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

