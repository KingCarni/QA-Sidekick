# QAS-88 Feature Builder Full QA Pass

## Build / Smoke

- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run build` passes.
- [ ] App loads `/app` without console crashes.
- [ ] User can sign in.
- [ ] Project dropdown loads active project.
- [ ] Existing tools still appear: Test Cases, Bug Writer, Risk Review, Test Improver, Feature Builder.

## Feature Builder Entry

- [ ] Feature Builder card is visible in QAtalyst Toolbelt.
- [ ] Clicking Feature Builder opens the Feature Builder workspace.
- [ ] Rough Feature Idea textbox is available.
- [ ] Extra Context / Constraints textbox is available.
- [ ] Live Prompt Companion is visible.
- [ ] Build Feature Brief is disabled for empty/too-short input.
- [ ] Placeholder text is product-neutral and does not include `QAtalyst` in the example.

## Live Prompt Companion

- [ ] Readiness score updates as the rough idea changes.
- [ ] Missing callouts update as context is added.
- [ ] Prompt tabs work: Brainstorm, Scope, QA, Acceptance, Jira.
- [ ] Clicking a local prompt appends it to the draft.
- [ ] Suggested next question appends to the draft.
- [ ] AI prompt button is disabled until enough context exists.
- [ ] AI prompt request returns useful prompts.
- [ ] AI prompt errors display clearly and do not wipe the draft.

## Generate Brief

- [ ] Paste `feature-builder-fixture-qas-88.json` rough feature idea.
- [ ] Paste fixture extra context.
- [ ] Click Build Feature Brief.
- [ ] Loading state is visible.
- [ ] Generated title appears.
- [ ] Generated sections render:
  - [ ] Summary
  - [ ] User Value
  - [ ] Problem
  - [ ] Target Users
  - [ ] In Scope
  - [ ] Out of Scope
  - [ ] User Stories
  - [ ] Acceptance Criteria
  - [ ] QA Risks
  - [ ] Test Ideas
  - [ ] Open Questions
  - [ ] Jira-ready Notes
- [ ] Copy Markdown copies current brief content.
- [ ] Save/Promote Source Vault controls are visible.

## Refinement Loop

- [ ] Refinement Loop renders as card buttons, not inline text.
- [ ] Tighten Scope updates the brief.
- [ ] Add QA Risks updates QA risks/test ideas.
- [ ] Generate Acceptance Criteria updates acceptance criteria.
- [ ] Find Missing Questions updates open questions.
- [ ] Make Jira-ready updates Jira notes/user stories.
- [ ] Simplify MVP tightens in-scope/out-of-scope.
- [ ] Expand Future Enhancements adds later-phase thinking without bloating MVP.
- [ ] New/changed refinement content appears in green.
- [ ] Refinement does not clear original rough idea.
- [ ] Refinement uses user-edited brief content.

## Edit / Versioning / Artifact Flow

- [ ] Edit Brief toggles editable fields.
- [ ] User can edit title.
- [ ] User can edit text fields.
- [ ] User can edit list sections, one item per line.
- [ ] Preview Brief returns to display mode.
- [ ] Copy Markdown includes user edits.
- [ ] Save Draft Version creates a new version.
- [ ] Version history shows v1/v2/v3.
- [ ] Restoring a previous version updates visible brief.
- [ ] Approve Brief updates artifact status.
- [ ] Promote to Project Source Vault saves current/approved version.
- [ ] Source Vault save success message is visible.
- [ ] Saved source appears/selectable in Sources panel after refresh.

## Jira Creation

- [ ] Jira Integration config is saved.
- [ ] Refresh Issue Types works in Settings.
- [ ] Jira Creation panel appears after feature brief exists.
- [ ] Parent Issue Type can be changed.
- [ ] Child Work Mode can be changed.
- [ ] Include child work checkbox works.
- [ ] Include QA planning task checkbox works.
- [ ] Parent issue preview updates from current brief.
- [ ] Child work preview updates from current brief.
- [ ] QA task preview updates from QA risks/test ideas.
- [ ] Create Jira Feature Work requires explicit click.
- [ ] Successful creation displays parent Jira key.
- [ ] Successful creation displays child Jira keys.
- [ ] Successful creation displays QA planning task key when enabled.
- [ ] Invalid Jira config shows helpful error.
- [ ] Revoked/invalid Jira token shows helpful error.
- [ ] If decryption fails, error tells user to re-save Jira API token.

## Regression — Existing Tools

- [ ] Test Cases still generates a report.
- [ ] Risk Review still generates a report.
- [ ] Bug Writer still generates a report.
- [ ] Bug Writer can create Jira issue.
- [ ] Test Improver still generates a report.
- [ ] Project Sources panel still opens above content.
- [ ] Menu dropdown renders above Toolbelt.
- [ ] Account/sign-out buttons still work.

## Edge Cases

- [ ] Empty rough idea blocks generation.
- [ ] Very short rough idea blocks generation.
- [ ] Very long rough idea does not break layout.
- [ ] Special characters/markdown in rough idea do not break output.
- [ ] Network failure shows error and preserves draft.
- [ ] OpenAI API failure shows error and preserves draft.
- [ ] Jira API failure shows error and preserves brief.
- [ ] User can recover by editing and retrying.
