
## Requirements

<img src="https://github.com/user-attachments/assets/77ff6913-e6d7-4fe0-b9a0-bf66f5e8f745" style="height: 1em; vertical-align: middle;"> **Streamer.Bot (For Twitch, YouTube, and/or Kick)** <br>
If you need help setting this up, visit their [website](https://streamer.bot/).

<img src="https://github.com/user-attachments/assets/3ec8eac2-17d2-4a97-a066-e55c1e29d2c5" style="height: 1em; vertical-align: middle;"> **Tikfinity (For TikTok)** <br>
You need this to be able to listen to TikTok events. If you need help setting this up, you can check out my [Tikfinity Setup Guide](https://www.notion.so/Tikfinity-Setup-Guide-241088f4f93e8051b991c6ef4b659934?pvs=21).

## Video Tutorial
[<img alt="Github Thumbnail" src="https://github.com/user-attachments/assets/63ec415f-2e2d-43cb-b4fe-6451966766eb" />](https://youtu.be/kynM8l7CP3o)

> [!NOTE]
> The video is a little bit outdated because this was made for the initial release. It still teaches the core of how to install it but there's more details down below.

##  Installation

### 1. Open Streamer.bot (For Twitch, YouTube or Kick)

You need to have WebSocket Server enabled:
        
<img alt="image" src="https://github.com/user-attachments/assets/e7635495-9b25-4276-8be1-154402a82298" />

        
### 2. Open TikFinity (For TikTok)

TikFinity’s WebSocket Server is on by default so there’s nothing else that needs to be done

### 3. Import Streamer.bot Actions

- Copy the [import code](https://github.com/rexbordz/rexbordz.github.io/blob/main/multi-poll/import.sb)
- Click `Import` and paste the code into the textbox

  <img alt="image" src="https://github.com/user-attachments/assets/a8008849-b776-416b-a945-32d25b36f09c" />

- Click `Import` and then just click `Yes` to all the prompts especially the last one

  <img alt="image" src="https://github.com/user-attachments/assets/f1c7232c-dd73-4059-968b-a1f216f245cd" />

### 4. Configure Your Overlay

Open the settings page by clicking `Configure this widget in the settings editor` [here](#configure-widget).

Once in the settings page, configure the widget to your heart's desire.

### 5. Connect Your OBS to the Settings Page

If your OBS WebSocket settings is set to default, you shouldn't have to do anything after opening the settings page. However, in case your websocket's port is different and you have a password set, you can configure it here, and then just click `Connect`.

### 6. Add the Overlay to OBS

There are 2 ways to accomplish this:

- **Method 1 (Recommended)**

  Click `Add New Source to OBS`, pick the **Scene**, set a **Source name**, and then click `Create & Load`

  ![Step 6a](docs/assets/step6a.png)

- **Method 2 (Traditional and Familiar)**

  Click the `Copy Current Settings URL` button and manually add the browser source into your OBS.

  ![Step 6b](docs/assets/step6b.png)

  <img alt="image" src="https://github.com/user-attachments/assets/f58e8a21-b4a5-4106-80cd-a61b0e2b2406" />
  
### 7. Controller Dock

Copy the link below to add the controller as a Custom Browser Dock to your streaming software of choice. 
    
```xml
https://rexbordz.github.io/multi-poll/dashboard
```
<img alt="image" src="https://github.com/user-attachments/assets/bac659a5-fe9e-4db1-ab3f-0e555ca8bf3d" />
        
### 8. Starting a Poll 

First two choices are required. When you’re ready, just click `Start Poll`.

<p align="center">
  <img alt="image" src="https://github.com/user-attachments/assets/a7b557b1-6204-43cd-8bc0-d402d4ccdfcf" />
</p>
<img alt="image" src="https://github.com/user-attachments/assets/a1b73a02-39c1-463a-8647-7b8e1ed60ced" />

> [!TIP]
> ✅ **SUCCESS!** You have successfully installed Multipoll.

## Editing an Existing Browser Source

The settings page is programmed to detect any live browser source of the widget. To edit any existing one, just load that browser source by following the steps in the screenshot.

![Edit 1](docs/assets/Edit1.png)

When you're done editing the settings, just click `Save to Source` and it will automatically update the browser source in OBS.

![Edit 2](docs/assets/Edit2.png)

## Stream Deck

The actions are also compatible with Stream Deck. Just download the pre-made stream deck profiles I made [here](https://github.com/rexbordz/rexbordz.github.io/tree/main/multi-poll/streamdeck), and import the correct variant to your Stream Deck Software. Through the Streamer.bot integration, some of the buttons are responsive and know the state of your current poll.

<img alt="image" src="https://github.com/user-attachments/assets/b64e2def-15d4-4ae4-83ce-2b00739b1ece" />
<img alt="image" src="https://github.com/user-attachments/assets/4084dd0d-c0fb-4209-9330-f125f00c6785" />

## For the Nerds
> [!TIP]
> When you right click a **MultiPoll Widget • Poll Started** trigger and click **Requeue**, it will run that poll again with the same poll configuration.

<img alt="image" src="https://github.com/user-attachments/assets/ab9d53e0-b881-4147-969a-27dabad054b7" />

<br>
<br>

> [!TIP]
> You can also get the import code and the download link for the stream deck profiles through this button. It will also show you the status of all the Streamer.bot actions associated with the poll. A yellow dot at the bottom right suggests that you're missing at least one action

<p align="center">
<img alt="image" src="https://github.com/user-attachments/assets/c86e5a99-e98d-4544-a32a-e38c4abee242" />
    
<img alt="image" src="https://github.com/user-attachments/assets/8e4a0c58-0abc-4beb-b36e-fd5e8eedb54a" />
</p>

## Donate

Your donations help me create better content and improve stream quality! If you'd like to support my work and see more of it, you can donate through the following:

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/M4M3C7R1J)