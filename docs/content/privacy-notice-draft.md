# Privacy notice — agent draft for DPO review (m1-027)

| | |
|---|---|
| **Status** | **DRAFT, not reviewed by the DPO.** Written by the agent at the owner's direction (2026-11-02, D-CONTENT-15). Not legal advice. Must not be published or chosen in Global Content until a named human (owner or DPO) approves it and records the approval. |
| **Source of facts** | What the new site does, from the code and runbooks: [form operations](../runbooks/form-operations-and-privacy.md), [security configuration](../runbooks/security-configuration.md), [design tokens](./design-tokens.md) (self-hosted fonts), D-CONTENT-14 (video), and the cookie the server sets (checked on the local server, 2026-11-02). The live site (www.assurerworld.com) has no privacy notice to migrate ([inventory](./wordpress-site-inventory.md)). |
| **CMS copy** | Draft page "Privacy notice", slug `/privacy`, unpublished. This file and the page must say the same thing; this file is the review copy. On the page, the title is the H1, the first paragraph is a "DRAFT" banner, and each `##`/`###` heading is an H2/H3 in one rich-text widget. |

**Placeholders.** Text in `[[DPO: …]]` is a question for the owner or DPO. The agent has not
filled it in, because the answer is a legal or business decision. No law is named, and the
draft makes no claim that the site complies with any law.

**Re-check before approval.** The facts below are true for the code at m1-027. They change if
the hosting, the email provider, D-FORM-1 (values in emails), D-FORM-2 (retention), D-CONTENT-14
(video) or analytics change.

---

## Notice text (as entered on the draft page)

# Privacy notice

*Last updated: [[DPO: date of approval]]*

This notice explains what personal information this website collects, why, and what you can
do about it. It covers this website only. [[DPO: say whether other Assurer World services or
offline dealings have their own notice, and link it.]]

## Who is responsible

This website is operated by [[DPO: legal name of the company responsible for the website and
its contact requests, and its registered address]]. For questions about this notice or your
information, contact [[DPO: privacy contact email or postal address; name of the data
protection officer, if one is appointed]].

## What we collect and why

### When you send us a message

If you use a contact form on this website, we receive the details you enter. The forms ask for
your name, email address and message, and may ask for your company and the subject of your
enquiry. Required fields are marked on each form. Please do not include sensitive information
in your message.

We use these details only to answer your enquiry and to keep a record of it. [[DPO: legal basis
for this use, for each country where Assurer collects enquiries.]]

Your message is stored on our website server. A short email notice is sent to our company
mailbox so that staff know a new message has arrived. [[DPO/owner: confirm whether the email
contains only the fact that a message arrived, or also your details (decision D-FORM-1).]]
Only authorised staff can read submitted messages.

### Protecting the forms

To stop automated spam, the website counts how often a form is sent from each network address
(IP address). The count is kept for 15 minutes and then deleted automatically. The forms also
contain a hidden check field and a short timer; these do not identify you and are not stored.
We do not use any third-party CAPTCHA service.

### Technical records

Like most websites, our server records technical events, such as errors and failed form
attempts, so that we can keep the website secure and working. Records of staff access to
submitted messages include the staff member and the network address used. [[DPO/owner: how
long these logs are kept, and whether the hosting provider keeps its own access logs (hosting
not yet chosen).]]

## Cookies

This website sets one cookie for visitors:

- **vcl-assurer-group.csrf** (security, about 9 hours): lets the website check that a form was
  sent from this site and not forged by another site. It contains no personal information.

Staff who sign in to edit the website also receive session cookies that keep them signed in.
We do not use advertising or analytics cookies, and we do not track you across other websites.
[[DPO: confirm whether a cookie banner is needed for strictly necessary cookies only, in each
country concerned.]]

## Other companies

- **Fonts** are served from our own server. No font service receives your information.
- **Maps and videos:** the website does not currently show third-party maps or videos. If a
  page later shows a video from a provider such as YouTube or Vimeo, your browser connects to
  that provider when the page loads. [[DPO: decide whether to name providers here, or require
  click-to-load before any video is used (decision D-CONTENT-14).]]
- **Email:** the notice of a new message is sent through [[owner: email provider, not yet
  chosen]].
- **Hosting:** the website and its data are hosted by [[owner: hosting provider and country,
  not yet chosen]].

We do not sell your information. [[DPO: list any other recipients, such as group companies
that may handle your enquiry, and any transfers to other countries with the safeguards used.]]

## How long we keep it

We keep messages sent through the website forms for [[DPO: retention period, e.g. the 180
days proposed in decision D-FORM-2]] and then delete them. Copies in backups are deleted when
those backups expire, within [[owner: backup retention period]]. If your enquiry leads to a
business relationship, the relevant details move to our business records and are kept under
their own rules.

## Your choices and rights

You can ask us for a copy of the information you sent through this website, and ask us to
correct or delete it. To make a request, contact us at the address above. We will check your
identity before acting on a request. [[DPO: list the rights that apply in each country
concerned, response time, and the right to complain to a supervisory authority, with its
name.]]

## Changes to this notice

If we change this notice, we will publish the new version on this page with a new date.

---

## Review checklist for the DPO (not part of the notice)

1. Fill in or delete every `[[…]]` placeholder.
2. Confirm the facts in "What we collect" against the live configuration before go-live
   (form fields as built by editors, D-FORM-1, D-FORM-2, email and hosting providers).
3. Decide D-CONTENT-14 (video) and the cookie-banner question.
4. Decide the optional lead-in text shown before the privacy link on forms (Global Content →
   Privacy → "Text before the privacy link on forms").
5. Record approval (name, date) in the decision register. Only then publish the page and
   choose it in Global Content → Privacy → "Privacy notice page".
