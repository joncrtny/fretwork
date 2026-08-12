/* The Help & FAQ view. Questions are grouped into themed sections so the page
   reads as a beginner's guide, not a wall of text. Answers lead with a direct,
   plain-language sentence (useful on its own, and a clean featured-snippet
   target), then add practical detail. Kept as data so the on-page content and
   the FAQPage structured data come from one source: faqJsonLd() below builds
   the JSON-LD from exactly these questions, so the schema always matches what
   a visitor reads. British English, no jargon left unexplained. */
export const FAQ_SECTIONS = [
  {
    id: "getting-started",
    title: "Getting started",
    items: [
      {
        q: "What is Fretwork?",
        a: "Fretwork is a free, interactive guitar fretboard for learning the neck. You can look up scales, chords with fingerings, arpeggios, intervals and progressions, hear them played, and practise with a metronome, ear trainer, chord-change trainer, strumming trainer, fretboard quiz and tuner. It runs in your browser on any device, with nothing to install.",
      },
      {
        q: "Is Fretwork free?",
        a: "Yes. Fretwork is, and always will be, free and without ads. No account or payment is needed to use any part of it.",
      },
      {
        q: "Is Fretwork good for complete beginners?",
        a: "Yes. Simple mode trims the app to the essentials so it is not overwhelming, every shape can be heard as well as seen, and a short tour explains the layout. You earn points and badges as you practise, which helps you keep a daily habit going.",
      },
      {
        q: "I have never played guitar. Where do I start?",
        a: "Start with a few open chords such as E minor, A minor and D, learn to change between them in time, and add one simple strumming pattern. Turn on Simple mode and take the quick guided tour first, so you are not faced with everything at once. Fretwork shows each shape and plays it, so you can check yourself by ear as you go.",
        view: "chord",
      },
      {
        q: "Do I need an account to use Fretwork?",
        a: "No. Everything works without one, and your work is saved in your browser on your device. An optional free account, which needs only a username and no email address, syncs your saved shapes and progress across devices.",
        view: "account",
      },
      {
        q: "Which instruments and tunings does Fretwork support?",
        a: "Six, seven and eight string guitar, bass, ukulele and mandolin, in standard, drop, open and other alternative tunings, with a capo. Change the instrument and tuning in Settings and every view updates to match.",
      },
    ],
  },
  {
    id: "first-steps",
    title: "First steps and common worries",
    items: [
      {
        q: "What should I learn first on guitar?",
        a: "Learn to tune up, read a chord diagram, then your first two or three open chords, then how to change between them in time with one strumming pattern, then a simple song. Keep the list short at first: a handful of chords already covers a huge number of songs. Add scales later, once chords feel steady.",
        view: "chord",
      },
      {
        q: "What are the easiest first chords to learn?",
        a: "E minor is the easiest, needing just two fingers with no awkward stretch, with A minor and D close behind. C and G are the trickiest of the common open chords, so save them for last. Learn a few, get them changing cleanly, and you can already play plenty of songs. The Chords view shows the fingering and plays each one.",
        view: "chord",
      },
      {
        q: "Which guitar should I buy, and does it need to be expensive?",
        a: "Almost any playable guitar is fine to start on, and a cheap or borrowed one is genuinely okay: you do not need to spend much. Acoustic is grab-and-play, while electric has lighter strings that press more easily, so pick whichever suits the music you want to make. Fretwork works with all of them, so you can plan on any guitar.",
      },
      {
        q: "How do I hold the guitar?",
        a: "Sit with the waist of the guitar resting on your leg and the neck angled slightly upward, keeping your back fairly straight. Curl your fretting fingers so they come down on their tips, and rest your thumb behind the neck rather than gripping over the top. Stay relaxed, as tension is the main thing that gets in the way at the start.",
      },
      {
        q: "Do I need a pick, and how do I hold one?",
        a: "A pick is not essential, but most beginners start with one for strumming, as it gives a brighter, more even sound. Hold it between the pad of your thumb and the side of your index finger, with just the tip showing, and grip it lightly rather than tightly. You can also strum and pick with your fingers, so try both and keep what feels natural.",
      },
      {
        q: "Why do my chords sound bad or buzzy?",
        a: "Buzzing and muted strings are almost always finger placement, not the guitar. Press just behind the fret rather than on top of it, come down on the very tips of your fingers so they do not touch and mute the next string, and press only as hard as it takes for a clean note. If it still buzzes everywhere after that, the guitar may need a setup, a small adjustment a guitar shop makes to lower the strings and make it easier to play.",
        view: "chord",
      },
      {
        q: "How hard should I press the strings?",
        a: "Only as hard as it takes for the note to ring cleanly, and no harder. Pressing too hard tires your hand and can pull notes sharp. Placing your finger just behind the fret, rather than in the middle of it, means you need much less force.",
      },
      {
        q: "Why can't I remember chord shapes?",
        a: "That is completely normal, and it is coordination rather than memory, so the shapes come with repetition and not with cramming. Learn just two shapes at a time and practise moving between them, instead of piling on many at once. The chord-change trainer drills exactly this, and the more you repeat a change the sooner your hand does it without thinking.",
        view: "changes",
      },
      {
        q: "How do I change chords faster and more smoothly?",
        a: "Learn each chord solidly on its own first, then practise the change itself: swap slowly and cleanly, moving as few fingers as possible and looking ahead to the next shape. Keep your strumming hand moving even if you have to slow right down. The chord-change trainer counts your clean changes in a minute so you can watch the number climb.",
        view: "changes",
      },
      {
        q: "How do I learn my first song?",
        a: "Pick a song that uses only two or three chords you know, look up its chords, and play each shape from the Chords view to check it. Add one simple strumming pattern, then slow the whole thing right down and loop the tricky bar until it is smooth. Speed comes last, after the changes are clean.",
        view: "chord",
      },
      {
        q: "Do my fingers have to hurt, and when does it stop?",
        a: "Sore fingertips are normal for the first few weeks while the skin toughens into calluses, so play in short, frequent sessions rather than long grinding ones. Tender fingertips are fine, but pain in your joints, wrist or thumb is not, and usually means your technique or the guitar needs adjusting. Lighter strings, and having a shop set the strings a little lower (this is called the action), also help.",
      },
      {
        q: "Is it too late to learn guitar as an adult?",
        a: "No. Adults learn guitar very successfully at any age, and the idea that you must start as a child is a myth. Grown-ups actually bring focus, patience and the ability to practise deliberately. The real limits are time and being kind to yourself, not your age.",
      },
    ],
  },
  {
    id: "tuning",
    title: "Tuning your guitar",
    items: [
      {
        q: "What is standard guitar tuning (EADGBE)?",
        a: "Standard tuning is E, A, D, G, B, E from the lowest, thickest string to the highest, thinnest one. Almost every beginner lesson and chord shape assumes it, so it is the tuning to start with. Fretwork defaults to standard tuning, and you can change it in Settings.",
        view: "tuner",
      },
      {
        q: "How do I tune my guitar?",
        a: "Open the Tuner, allow microphone access, and play one string at a time, firmly, letting it ring while you mute the others. The tuner shows the note and whether it is flat (too low) or sharp (too high): tighten the peg to go up, loosen it to go down, and always tune up to the note for stability. Tune all six, then check them again, as tuning one nudges the others.",
        view: "tuner",
      },
      {
        q: "Why does my guitar keep going out of tune?",
        a: "Brand new strings stretch for the first week or two, so they drift flat until they settle; stretching them gently by hand and retuning speeds this up. Big changes in temperature, and pegs that were tuned downwards rather than up to pitch, also cause slipping. Constant tuning of old, dull strings can mean it is time to change them.",
        view: "tuner",
      },
      {
        q: "When should I change my guitar strings?",
        a: "Strings gradually turn dull, darker in colour and harder to keep in tune, and most players change them every couple of months, sooner if they play a lot. Fresh strings sound noticeably brighter and hold their tuning better. If yours look grimy or sound lifeless, it is probably time.",
      },
      {
        q: "What are alternative tunings like drop D?",
        a: "An alternative tuning changes one or more strings away from standard to make certain sounds or shapes easier. Drop D lowers just the low E string to D, giving a heavier low end and one-finger power chords. Fretwork supports drop, open and other tunings and redraws every shape to match.",
        view: "tuner",
      },
      {
        q: "Does the tuner use my microphone, and is that private?",
        a: "The tuner uses your microphone only while it is open, and the sound is analysed on your device: nothing is recorded, stored or uploaded. When you close the tuner, the microphone is released. If it is not hearing your guitar, grant microphone permission, reduce background noise and play closer to the device.",
        view: "tuner",
      },
    ],
  },
  {
    id: "reading",
    title: "Reading chord charts, tab and the fretboard",
    items: [
      {
        q: "How do I read a guitar chord chart?",
        a: "A chord chart, also called a chord diagram or chord box, is a picture of the neck stood upright and facing you: the vertical lines are the six strings with the low E on the left, the horizontal lines are the frets, and each dot shows where to put a finger. The symbols above the top, X or O, tell you which strings to skip or play open, and any numbers tell you which finger to use.",
        view: "chord",
      },
      {
        q: "What do the X and O symbols mean on a chord chart?",
        a: "Above the chord, O means play that string open, with no finger, and X means do not play that string, or mute it. So an X above the low E of a C chord tells you not to strum that string. Fretwork marks both on every chord diagram.",
        view: "chord",
      },
      {
        q: "What do the numbers on a chord diagram mean? Are they frets?",
        a: "They are fingers, not frets. 1 is the index finger, 2 the middle, 3 the ring and 4 the little finger, and a number by a dot means fret that note with that finger. The dot's position already shows the fret, so the number only tells you which finger to use.",
        view: "chord",
      },
      {
        q: "What are the guitar string names, and which is the first string?",
        a: "From thickest and lowest to thinnest and highest, the strings are E, A, D, G, B, E, which many remember as Eddie Ate Dynamite, Good Bye Eddie (read thick to thin). Confusingly, the string numbers run the other way: the thin high E is the 1st string and the thick low E is the 6th. High and low refer to pitch, not to physical position.",
        view: "tuner",
      },
      {
        q: "How do I read guitar tab?",
        a: "Tab is six lines for the six strings, but the top line is the high E and the bottom the low E, the opposite way up to a chord diagram. A number on a line is the fret to press, and 0 means play that string open. Read left to right; numbers stacked in a column are played together, and plain tab shows the notes but not the rhythm.",
      },
      {
        q: "How is the fretboard laid out?",
        a: "Every fret raises the pitch by one semitone, so moving up one fret gives you the next semitone along. The same note appears in several places across the strings, which is what makes the neck feel confusing at first. The dots at frets 3, 5, 7, 9 and the double dot at 12 are just position markers, the same on most guitars.",
        view: "quiz",
      },
    ],
  },
  {
    id: "chords",
    title: "Chords and harmony",
    items: [
      {
        q: "What is a chord?",
        a: "A chord is two or more notes played together, though most chords are triads, built from three: a root, a third and a fifth. The third is the note that makes a chord sound major or minor. In the Chords view you can see any chord's notes on the neck and hear it.",
        view: "chord",
      },
      {
        q: "What makes a chord major or minor?",
        a: "The third of the chord is the switch. A major third (four frets, or four semitones, above the root) gives the bright, open sound we call major, and a minor third (three frets) gives the darker sound we call minor. Everything else in the chord can be the same, so it really is one note that changes the mood.",
        view: "chord",
      },
      {
        q: "What is the difference between open chords and barre chords?",
        a: "Open chords are played down near the nut, at the first few frets, and use some open, unfretted strings, which makes them ring easily and suits beginners. Barre chords use one finger laid flat across several strings, so nothing is open, which lets you move a single shape anywhere on the neck. Learn open chords first; barre chords come once your hand is stronger.",
        view: "chord",
      },
      {
        q: "What is a barre chord, and why are they hard?",
        a: "A barre chord uses one finger, usually the index, pressed flat across several strings at one fret, so it works like a movable capo and the shape plays anywhere on the neck. They feel hard at first because they need even pressure and stamina, not brute strength. It helps to place the finger right behind the fret, roll slightly onto its bony edge, and keep your thumb low behind the neck.",
        view: "chord",
      },
      {
        q: "What is a power chord?",
        a: "A power chord is built from just two notes, the root and the fifth (often with the octave added on top), and has no third, so it is neither major nor minor and fits over almost anything. That neutral, solid sound, especially with distortion, is why power chords are everywhere in rock and punk. With no third to place, they are one of the easiest shapes to learn.",
        view: "chord",
      },
      {
        q: "What is a chord progression?",
        a: "A chord progression is a sequence of chords played in order, and it is the harmonic backbone of a song. A very common one is I, V, vi, IV, which in the key of G is G, D, E minor, C, and turns up in countless pop songs. The Progressions view shows popular progressions in any key with the shapes to play.",
        view: "prog",
      },
      {
        q: "What do the Roman numerals I, IV and V mean in a chord progression?",
        a: "The Roman numerals number the chords built on each step of a key's scale, so in the key of C, I is C, IV is F and V is G. Capital numerals are major chords and lower-case ones (like vi) are minor. Numbering chords this way lets the same progression be described in any key at once.",
        view: "prog",
      },
      {
        q: "What is a capo and what does it do?",
        a: "A capo is a clamp that bars all the strings at one fret, acting as a new movable nut so the whole guitar sounds higher. You keep playing the same easy shapes, but they come out in a higher key, which is handy for matching a singer. A capo can only raise the key, never lower it, and using one is a normal tool, not cheating.",
        view: "chord",
      },
    ],
  },
  {
    id: "rhythm",
    title: "Rhythm, timing and the metronome",
    items: [
      {
        q: "What is a time signature?",
        a: "A time signature is the two stacked numbers at the start of a piece that group the beats. The top number is how many beats are in each bar, and the bottom number is which kind of note gets one beat (a 4 means a quarter note). It is not a fraction; it sets the feel before a note is played.",
      },
      {
        q: "What does 4/4 time mean?",
        a: "4/4 means four beats in every bar, and each beat is a quarter note, counted one, two, three, four. It is by far the most common time signature in pop, rock and folk, which is why it is also called common time. Most songs you first learn are in 4/4.",
      },
      {
        q: "What is tempo, and what does BPM mean?",
        a: "Tempo is how fast the music goes, and BPM stands for beats per minute, the number of beats in one minute. 60 BPM is one beat every second, and 120 BPM is twice as fast. The metronome in Fretwork lets you set any tempo to practise to.",
        view: "strum",
      },
      {
        q: "What are note values like quarter and eighth notes?",
        a: "Note values say how long a note lasts against the beat. In 4/4 a whole note lasts four beats, a half note two, a quarter note one, and an eighth note half a beat, so two eighths fit in one beat. Counting out loud, such as one-and-two-and, is the quickest way to feel them.",
      },
      {
        q: "How do I practise with a metronome, and what tempo should I start at?",
        a: "Set the metronome slow enough that you can play the part perfectly, which is often well below the speed you are aiming for, then line every note up with the click. Only raise the tempo a few beats per minute once it is clean and relaxed. Slow, accurate repetition is what builds real speed, not rushing.",
        view: "strum",
      },
      {
        q: "How do I read a strumming pattern?",
        a: "A strumming pattern is written as down and up arrows under the count, such as down, down-up, up-down-up, and it repeats while the chords change over it. The key that most guides miss is to keep your strumming hand moving up and down steadily the whole time, and simply miss the strings on the beats you do not play. The strumming trainer shows this against a beat.",
        view: "strum",
      },
    ],
  },
  {
    id: "scales-intervals",
    title: "Scales, keys and intervals",
    items: [
      {
        q: "What is a scale?",
        a: "A scale is an ordered set of notes that belong together and form the palette for melodies and solos in a key. It is played one note at a time, which is what makes it different from a chord. The major scale and the minor pentatonic scale are the two most useful to learn first, and the Scales view lights up every note across the neck.",
        view: "scale",
      },
      {
        q: "What is the major scale?",
        a: "The major scale is the familiar seven-note do-re-mi scale, built by the step pattern tone, tone, semitone, tone, tone, tone, semitone from its starting note. It is the reference every other scale and interval is measured against. Learn one moveable pattern and you can play it in any key by starting on a different root.",
        view: "scale",
      },
      {
        q: "What is the pentatonic scale?",
        a: "The pentatonic scale has five notes instead of seven, made by dropping the two most clashing notes from the major or minor scale, which is why it sounds forgiving and is the go-to for first solos. The minor pentatonic is the classic rock and blues shape. It is not that any note works, but that fewer notes can clash.",
        view: "scale",
      },
      {
        q: "What is a key, and how is it different from a scale?",
        a: "A scale is just an ordered set of notes; a key is those notes organised around a home note, the tonic, that the music keeps resolving to. So C major the scale is the notes, and the key of C major is a piece that treats C as home and draws its chords from that family. Knowing the key tells you which scale fits and which chords are likely.",
        view: "scale",
      },
      {
        q: "What is an interval in music?",
        a: "An interval is the distance in pitch between two notes. On the guitar it is easy to see: one fret is a semitone (a half step), two frets is a tone (a whole step), and larger gaps have names like a major third (four frets) or a perfect fifth (seven frets). Intervals are the building blocks of every scale and chord, and the Intervals view plays each one from any root.",
        view: "interval",
      },
      {
        q: "What is the difference between a tone and a semitone?",
        a: "A semitone, or half step, is the smallest gap in Western music: one fret on the guitar. A tone, or whole step, is two semitones, so two frets. Scales are just particular patterns of tones and semitones, which is why the same shape works from any starting note.",
        view: "interval",
      },
      {
        q: "What is an octave?",
        a: "An octave is the distance from a note to the next note of the same name, higher or lower, such as one E up to the next E. It is twelve semitones, or twelve frets up a single string. Notes an octave apart sound like the same note in a higher or lower voice.",
        view: "interval",
      },
      {
        q: "What are sharps and flats?",
        a: "Sharps and flats are the pitches a semitone (one fret) above or below a letter note: a sharp raises it and a flat lowers it. Most letters have a note between them, but B to C and E to F are already only a semitone apart, so there is no fret between those. The same pitch can have two names, so F sharp and G flat are the same fret.",
        view: "interval",
      },
      {
        q: "What is an arpeggio, and how is it different from a chord?",
        a: "An arpeggio is the notes of a chord played one at a time instead of all together, which is why it is also called a broken chord. So a chord is the notes stacked, an arpeggio is the same notes in a line, and a scale is a run of every note in the key. Arpeggios turn up in riffs, fingerpicking and solos, and the Arpeggios view plays them across the neck.",
        view: "arp",
      },
    ],
  },
  {
    id: "practice",
    title: "Practising and progress",
    items: [
      {
        q: "How long should I practise guitar each day?",
        a: "Short and regular beats long and rare: fifteen to twenty focused minutes on most days will take you further than one long session a week. Little and often is what builds both the habit and the coordination, and a rest day is fine. Fretwork tracks a daily streak to help you keep it going.",
      },
      {
        q: "How long does it take to learn guitar?",
        a: "Think in milestones, not one number. Most people can play a simple two or three chord song within a few weeks of regular practice, strum common songs comfortably in three to six months, and feel genuinely at home on the instrument in six to twelve. Progress depends far more on regular, focused practice than on talent.",
      },
      {
        q: "I feel like giving up, is that normal?",
        a: "Very. Almost everyone hits weeks where nothing seems to improve, a stage often called a plateau, and it usually means a jump forward is coming rather than that you have failed. When it bites, go back to a song you can already play to feel how far you have come, drop the tempo, or take a day off. Short, regular sessions and a little patience win in the end.",
      },
      {
        q: "How do I know if I am improving?",
        a: "Progress on guitar is gradual, so watch for the quiet signs: fewer buzzed notes, quicker recovery after a slip, cleaner chords at a slow tempo, changes that no longer need you to stare at your hand, and songs you can recall from memory. Fretwork's streak, points and quiz scores give you concrete numbers to watch rise over time.",
      },
      {
        q: "How do I memorise the notes on the fretboard?",
        a: "Learn the notes on the low E and A strings first, since they anchor most chords and barre shapes, then use octave shapes to find the same notes elsewhere. Short daily bursts work far better than one long cram. The Fretboard Quiz turns this into a game so the names start to come automatically.",
        view: "quiz",
      },
      {
        q: "Do I need to learn music theory to play guitar?",
        a: "Not to begin. Chord diagrams and tab let you start playing real songs straight away, and you can pick up theory gradually once you are curious about why things work. A little theory does speed up your progress later, but it is never a gate you must pass first.",
      },
    ],
  },
  {
    id: "using-fretwork",
    title: "Using Fretwork's tools",
    items: [
      {
        q: "What is Simple mode?",
        a: "Simple mode strips Fretwork back to the core so a beginner is not faced with advanced options too soon. It hides the more specialist scales, chords and controls, leaving a clean set to learn with. You can turn it off at any time as you grow into the app.",
      },
      {
        q: "What is ear training, and why should I use it?",
        a: "Ear training plays an interval or a chord and asks you to name it by listening, which trains your ear to recognise how notes sound against each other, the skill behind playing by ear and improvising. A few minutes a day pays off within weeks, and you build streaks and earn badges as your ear sharpens. If you cannot yet tell major from minor, that is normal and exactly what it trains.",
        view: "ear",
      },
      {
        q: "What is the Fretboard Quiz?",
        a: "The Fretboard Quiz asks you to find a named note, or a numbered note from a scale, on the neck, turning fretboard memorisation into a quick game. It is the fastest way to stop hunting for notes and start knowing where they are. Your accuracy is shown so you can watch it improve.",
        view: "quiz",
      },
      {
        q: "How do I save chords and scales I want to keep?",
        a: "Use the star button on any chord, scale, arpeggio or progression to save it to your Bank, a personal collection you can return to any time. The Bank keeps everything in one place for quick recall, and with a free account it syncs across your devices.",
        view: "bank",
      },
      {
        q: "What does marking something as known do?",
        a: "The lightbulb button marks a scale, chord or arpeggio as something you already know. Fretwork uses your known items to build a practice routine that revisits them and adds one new thing to stretch you, so practice stays focused on what is useful to you.",
        view: "routine",
      },
      {
        q: "How do points, levels and badges work?",
        a: "You earn points for practising: for minutes played, correct ear-training answers, chord changes and reaching badge tiers. Points raise your level, and badges reward milestones like ear-training streaks and daily habits. It is there to make regular practice rewarding, not to get in the way.",
      },
    ],
  },
  {
    id: "how-it-works",
    title: "How Fretwork works: saving, accounts and devices",
    items: [
      {
        q: "Where is my saved work stored?",
        a: "By default, everything you save (your Bank, settings and progress) is stored in your browser on the device you are using, so it stays private to you. Nothing is sent anywhere unless you create an account to sync. It is local to that browser, which is exactly why the optional account exists.",
      },
      {
        q: "Will I lose my saved shapes if I clear my browser or cache?",
        a: "If you clear this site's data or your browser storage, the work saved only on your device will be removed, because it lives in local storage. The way to protect it is to create a free account: your Bank and progress then sync to your account and come back when you sign in on any device.",
      },
      {
        q: "Why would I create an account?",
        a: "An account lets your saved shapes and progress follow you across devices, so you can start on a laptop and carry on from your phone, and it keeps them safe if you clear your browser. It is free and takes seconds to set up. Without one, everything still works and stays on your device.",
        view: "account",
      },
      {
        q: "Can I use Fretwork offline?",
        a: "Yes. Fretwork is a progressive web app, so once it has loaded it keeps working without a connection, which is handy for practising anywhere. Install it to your home screen to open it like a normal app, and your saved work is available offline too.",
      },
      {
        q: "Is Fretwork an app or a website? What is a progressive web app?",
        a: "Fretwork is a website that can install and behave like an app, which is what a progressive web app means: a home-screen icon, a full-screen view and offline use, with no app store and nothing large to download. You always have the latest version, because it updates itself from the web.",
      },
      {
        q: "How do I install Fretwork on my phone's home screen?",
        a: "On an iPhone or iPad, open Fretwork in Safari, tap the Share button, then Add to Home Screen. On Android, open it in Chrome and choose Install app, or Add to Home screen, from the menu. On a laptop, use the install icon in the browser's address bar. It then opens full screen like an installed app.",
      },
      {
        q: "Does Fretwork work on iPhone, Android, tablets and laptops?",
        a: "Yes. Fretwork runs in any modern web browser and adapts to the screen, so it works on iPhone and Android phones, tablets, laptops and desktops. Sign in and your instrument, tuning and saved work stay the same across them all. There is nothing to download from an app store.",
      },
      {
        q: "Is my data private, and what analytics do you use?",
        a: "No account or personal details are required to use Fretwork, and the tuner's microphone audio never leaves your device. Anonymous usage analytics (Google Analytics, Vercel Analytics and Amplitude) help improve the app, with no session recording. Feedback you send is stored so it can be acted on.",
      },
    ],
  },
];

/* Flat list of every question and answer, used by the FAQPage structured data
   and anywhere a single sequence is easier than the grouped sections. */
export const FAQS = FAQ_SECTIONS.flatMap((s) => s.items);
