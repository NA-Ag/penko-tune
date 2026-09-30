# Penko Tune for Teachers

Penko Tune is free, runs in any modern browser, needs no accounts and collects no data. That
makes it easy to use with students, including minors, without sign-ups or privacy paperwork for
the app itself.

---

## Music practice

| Need | How |
| --- | --- |
| Slow a passage down without changing its pitch | Speed button in the player (0.5×–2×), or `<` and `>` |
| Repeat a hard section | **A-B loop**: press `L` at the start, `L` at the end, `L` again to clear |
| Mark rehearsal sections ("verse 2", "bar 33") | Right-click the seek bar to add a chapter marker; rename it in the sidebar |
| Loop between two markers | Hover a marker in the sidebar and click the loop icon |
| Sing along without the lead vocal | Karaoke (microphone) button; works best on studio stereo mixes |
| Sing along with the words | Synced lyrics: drop `song.lrc` next to `song.mp3`, or paste lyrics in **Edit info** |

## Sharing material with a class

1. Put the practice tracks in a playlist.
2. Hover the playlist in the sidebar and click **Share**. Choose **Send a copy** if students
   should keep the files, or **Stream only** if they should just listen.
3. Send the link through your usual channel (LMS, email, chat).

Keep Penko Tune open on your computer while students download or listen: your device is the
only source. Once a student has saved a copy, they no longer need you online.

## Live listening lessons

Use **Listen together** (people icon in the header) to play music live to students' devices,
in stereo, including any EQ you apply. It's useful for ear training and listening exercises in
remote or hybrid lessons. Students follow along; only the host controls playback.

## Language learning

- Slow down dialogue or songs with the speed control; the pitch stays natural.
- Loop a sentence with A-B until it's clear.
- Synced lyrics highlight each line as it's sung. Click a line to jump to it.
- The sleep timer works well for audiobooks.

## Science and computing

- The **spectrum** and **bars** visualizers show frequencies in real time. Try a pure tone, then
  an instrument, to show harmonics, or move the EQ sliders to see what they change.
- For computing classes, [How Penko Tune Works](HOW_IT_WORKS.md) walks through the code:
  audio processing, databases in the browser, encryption and peer-to-peer networking. It ends
  with project ideas.

---

## School networks

Sharing and listen-together connect devices directly. Many school and work networks block
these connections, and the public trackers the app uses by default are on the internet.

If your IT team can help, Penko Tune can use your own infrastructure instead:

1. **A tracker** introduces devices to each other. The open-source
   [`bittorrent-tracker`](https://github.com/webtorrent/bittorrent-tracker) server supports the
   WebSocket protocol browsers need. Serve it over TLS (`wss://`) on your network.
2. **A TURN relay** such as [coturn](https://github.com/coturn/coturn) lets devices connect
   even when direct connections are blocked. Traffic then passes through the relay, so it uses
   your bandwidth.
3. In Penko Tune, open **Settings → Sharing network**. Add your tracker (and tick **Use only my
   trackers** to stay entirely on your network; this also turns off the public Nostr relays that
   listen-together uses by default) and your STUN/TURN servers, then save.

Everything stays end-to-end encrypted either way: trackers and relays never see the music.

## Privacy notes to share with families

- No accounts, no tracking, no ads. Music and settings stay on the device.
- When sharing or listening together, the devices involved can see each other's IP address, as
  with any direct connection.
- Share links contain the decryption key. Anyone with the link can listen, so share links
  only with the intended group.
