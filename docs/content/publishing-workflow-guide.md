# Publishing workflow guide (review before publish)

| | |
|---|---|
| **Status** | Agent draft (m1-037); for the business owner to review before staff rollout |
| **Decision** | [D-CONTENT-11](../engineering/decision-register.md), option B: review before publish, one approval per change |
| **Applies to** | Everyone who edits the website |

## 1. Roles

| Role | Who | Can do |
|---|---|---|
| **Contributor** | Content staff | Create and change **drafts** of pages, products, organisations, people, locations, forms and Global Content (contact details, footer, header button). **Submit** a draft for review. Choose images and files already in the media library |
| **Editor** | Named approvers (at least two, to cover absence) | Everything a contributor can do, plus **review** and **publish** submitted drafts, archive content, add images and files to the media library, and manage redirects |
| **Admin** | Developers | Everything, including user accounts, Global Styles and form submissions |

A contributor cannot publish, unpublish, archive or delete published content. The server refuses
these actions, as well as hiding the buttons.

The names of the people in each role are not kept in this repository.

## 2. Contributor: propose a change

1. Log in. Open the page, or open the item from **Content** (Products, Organisations, People,
   Locations) or **Global Content**.
2. Make the change. It is saved as a **draft**. Visitors still see the published version.
3. Select **Submit**. The message "Submitted to Admins and Editors for review" appears.
4. Tell an editor that a change is waiting. **The website sends no notification.**
5. To take a submission back before it is reviewed, open the draft and use **More Options** →
   **Dismiss Submission**.

Images and files: ask an editor to add new images or files to the media library. You can then
choose them in your draft.

## 3. Editor: review and publish

1. Log in. The **Manage Draft Submissions** icon in the admin bar shows how many drafts are
   waiting.
2. Open the icon. The list shows each draft, its type, when it was submitted and who submitted it.
3. Open a draft. Check the text, links, prices and legal wording. You can correct it yourself.
4. Select **Publish**. The change is now live and the submission leaves the list.
5. If the change should not go live, use **More Options** → **Dismiss Submission**. The draft is
   kept, unpublished. Tell the contributor why.

Check carefully before you publish: product claims, prices, contact details, regulatory and legal
text, and anything in Global Content (it appears on every page).

## 4. Points to know

- **Media is public at once.** An image or file in the media library is published as soon as an
  editor adds it. It shows on a page only when a published page uses it, but anyone who has its
  address can open it. Do not upload confidential files.
- **No email alerts.** Agree how contributors tell editors about waiting drafts (for example, a
  team chat message).
- **Accounts.** An admin creates accounts with the right role
  (`node app @apostrophecms/user:add <name> contributor` or `editor`) or in the Users manager. A
  role can be changed later without losing content.
