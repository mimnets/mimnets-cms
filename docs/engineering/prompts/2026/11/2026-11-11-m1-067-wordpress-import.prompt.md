# m1-067 — Prompt

Owner's request, verbatim (2026-11-11, new session):

> Start m1-066. Read AGENTS.md and docs/milestones/m1-066-handoff.md first, confirm the task with me,
> follow the gates, and stop for approval before any commit or push.

The ID `m1-066` had been used for the implicit state work (PR #77), so the agent asked, and the
owner confirmed: "yes m1-067, and option a for the two files". The task is the item of the
[m1-066 handoff](../../../../milestones/m1-066-handoff.md): the automated WordPress import into
drafts (D-CONTENT-17), design note first.

## Further requests and answers in the same session (verbatim, in order)

- "and i can see in the local server it's showing demo content but whereas we installed on the oci
  server it shows empty why?" (answered: the staging image loads no demo content by design)
- "and can you check the agents.md file and add into this" … "Always build code cleanly, modularly,
  and with proper architecture and separation of concerns. Never simply bolt on a feature because I
  asked for it. If you can't find an easy way to build it naturally, and you'd recommend a refactor
  to make the whole thing cleanly, stop your work ahead of time and say so." … "and where it would be
  best fit?" (added to AGENTS.md, PR #79, D-GIT-70)
- Design note answers: "Approve amendment (Recommended)", "Approve cheerio (Recommended)", "Leave
  them out (Recommended)", "All linked PDFs" (D-CONTENT-19)
- "instead of staging site build as we did earlier on oci server can we have tested locally and then
  build package to the docker image server or github and then pull directly on to oci server for
  everytime test on live production?" … "ok continue, pipeline as m1-068 and also tell me do we need
  both docker image and github package? I prefer docker image to docker hub so we can pull and run
  right?" … "what is your recommendation?" … "go with recommendation but tell before what is you are
  talking m1-068?" (D-DB-21: GitHub Container Registry; m1-068)
- "you didn't answer m1-068? and i recommend build with demo content instead of staging. and if live
  with demo content so how will it works as theme/template or direct content? i prefer as demo theme
  and then we can change alternative theme change options what do you think?" … "i agree with you"
  … "another question - do we have two or more them changing and selection options?" (D-CONTENT-20)
- "sorry - another question - i can see on the oci server there are no mongodb contianer. are there
  no mongodb contianer and if not than where the data is storing and isn't it better to have a
  seperate mongodb container so that maintaing the contianer and updating will be better and also
  linking and managing db dasboad on the apostrophe admin?" … "write in memory that i approve please
  keep all the contianer individual and separate" … "but inside on stack" (D-DB-20)
