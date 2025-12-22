# ClassRoyale Testing Scheme (Post-Chapter 5)

## Overview
This document outlines comprehensive testing procedures for ClassRoyale after Chapter 5 implementation (XP, Accounts, Unlocks) and Chapter 6 (Scoring System) including Chapter 6.5 (External Scoring).

---

## Pre-Testing Setup

### 1. Database Reset
```bash
# Clear all test data
node server/scripts/clearUsers.js

# Verify database is clean
sqlite3 data/classroyale.db "SELECT COUNT(*) FROM players;"
```

### 2. Server Restart
```bash
# Use restart script to clear caches
./restart.sh  # or restart.bat on Windows
```

### 3. Browser Setup
- Use **incognito/private mode** for each test user
- Clear browser cache between major test sessions
- Use different browsers for teacher vs students (Chrome, Firefox, Edge)

---

## Chapter 5: Authentication & XP System

### Test Suite 5.1: User Registration

#### Test 5.1.1: Student Registration
1. Navigate to `/register`
2. Enter student email: `123@nist.ac.th`
3. Enter display name: `TestStudent1`
4. Enter password: `password123`
5. **DO NOT** check "Register as Teacher"
6. Click "Register"
7. **Expected**: Success message with verification link
8. Click verification link
9. **Expected**: Redirect to `/verified?status=success`
10. Navigate to `/login`
11. Login with credentials
12. **Expected**: Redirect to `/student` (not `/teacher`)

#### Test 5.1.2: Teacher Registration
1. Navigate to `/register`
2. Enter teacher email: `teacher@nist.ac.th`
3. Enter display name: `TestTeacher`
4. Enter password: `password123`
5. **CHECK** "Register as Teacher"
6. Click "Register"
7. **Expected**: Success message with verification link
8. Verify and login
9. **Expected**: Redirect to `/teacher` (not `/student`)

#### Test 5.1.3: Student Email Cannot Register as Teacher
1. Navigate to `/register`
2. Enter email: `456@nist.ac.th` (starts with number)
3. Check "Register as Teacher"
4. Click "Register"
5. **Expected**: Error message: "Student emails cannot register as teachers"

#### Test 5.1.4: Invalid Email Domain
1. Navigate to `/register`
2. Enter email: `test@gmail.com`
3. Click "Register"
4. **Expected**: Error message about NIST email requirement

---

### Test Suite 5.2: Authentication & Authorization

#### Test 5.2.1: Protected Routes
1. **Without login**, navigate to:
   - `/teacher` → **Expected**: Redirect to `/login`
   - `/student` → **Expected**: Redirect to `/login`
   - `/profile` → **Expected**: Redirect to `/login`

#### Test 5.2.2: Root Path Redirect
1. Navigate to `/` (not logged in)
2. **Expected**: Redirect to `/login`
3. Login as teacher
4. Navigate to `/`
5. **Expected**: Redirect to `/teacher`
6. Logout
7. Login as student
8. Navigate to `/`
9. **Expected**: Redirect to `/student`

#### Test 5.2.3: Token Persistence
1. Login as student
2. Close browser tab
3. Reopen browser, navigate to `/student`
4. **Expected**: Still logged in (token in localStorage)
5. Clear localStorage manually
6. Navigate to `/student`
7. **Expected**: Redirect to `/login`

---

### Test Suite 5.3: XP System

#### Test 5.3.1: Initial XP State
1. Register new student account
2. Login and navigate to `/profile`
3. **Expected**: 
   - XP: 0
   - Level: 1
   - Progress bar at 0%

#### Test 5.3.2: Participation XP
1. Teacher starts a round
2. Student joins team and participates
3. Round ends (teacher submits scores)
4. Check `/profile` page
5. **Expected**: +5 XP for participation

#### Test 5.3.3: Round Winner XP
1. Student's team wins a round
2. Check `/profile` page
3. **Expected**: +3 XP bonus for round winner
4. **Total**: +8 XP (5 participation + 3 winner)

#### Test 5.3.4: Match Winner XP
1. Student's team wins match (5 rounds)
2. Check `/profile` page
3. **Expected**: +20 XP bonus for match winner
4. **Total**: +25 XP (5 participation + 20 winner) for final round

#### Test 5.3.5: Level Up
1. Accumulate 100+ XP through multiple rounds
2. Check `/profile` page
3. **Expected**: Level increases to 2
4. **Expected**: XP progress bar resets, shows progress to level 3

#### Test 5.3.6: XP Popup Display
1. Student participates in round
2. **Expected**: XP popup appears showing "+5 XP - Participation"
3. Student's team wins round
4. **Expected**: XP popup appears showing "+3 XP - Round Winner"

---

### Test Suite 5.4: Card Unlocks

#### Test 5.4.1: Initial Unlocks
1. New student (Level 1)
2. Navigate to `/student` page
3. Check card bar
4. **Expected**: 
   - `BLUR` unlocked (Level 1)
   - `DISTRACT` unlocked (Level 1)
   - `SHAKE` locked (Level 2)
   - `OVERCLOCK` locked (Level 3)

#### Test 5.4.2: Level Up Unlocks
1. Student reaches Level 2
2. Refresh `/student` page
3. **Expected**: `SHAKE` card now unlocked
4. Student reaches Level 3
5. Refresh `/student` page
6. **Expected**: `OVERCLOCK` card now unlocked

#### Test 5.4.3: Locked Card Display
1. View locked cards in card bar
2. **Expected**: 
   - Greyed out appearance
   - Lock icon visible
   - Tooltip shows unlock level requirement
   - Cannot be clicked/cast

---

## Chapter 6: Scoring System

### Test Suite 6.1: External Scoring Flow (Chapter 6.5)

#### Test 6.1.1: Round Data Broadcast
1. Teacher starts a round
2. Students submit answers
3. Round timer expires or teacher ends round
4. **Expected**: 
   - Teacher receives `ROUND_DATA` message
   - Scoring UI appears on teacher page
   - Shows all team answers
   - No scores displayed yet

#### Test 6.1.2: Student Pending State
1. Round ends
2. Check student page
3. **Expected**: 
   - "Waiting for teacher to score..." message displayed
   - No scores shown yet
   - Round result component shows pending state

#### Test 6.1.3: Teacher Score Submission
1. Teacher receives `ROUND_DATA`
2. Enter scores for each team (0-10)
3. Click "Submit Scores"
4. **Expected**: 
   - Success message or no error
   - Scoring UI disappears
   - `ROUND_SCORE` message broadcast to all clients

#### Test 6.1.4: Round Score Display
1. After teacher submits scores
2. **Student page**:
   - **Expected**: Round result shows evaluation scores
   - **Expected**: Round winner displayed
   - **Expected**: Match standings updated
3. **Teacher page**:
   - **Expected**: Match scores updated
   - **Expected**: Round winner displayed

#### Test 6.1.5: Score Validation
1. Teacher tries to submit invalid scores:
   - Score > 10 → **Expected**: Error message
   - Score < 0 → **Expected**: Error message
   - Missing score for a team → **Expected**: Error message
   - Non-numeric value → **Expected**: Error message

#### Test 6.1.6: Match Scoring
1. Teacher submits scores for multiple rounds
2. Check match scores (round points)
3. **Expected**: 
   - Round winner gets +1 point
   - First team to 5 points wins match
   - Match ends when win condition met

---

### Test Suite 6.2: Score Override (Optional)

#### Test 6.2.1: Override Existing Score
1. Teacher submits scores for round
2. Navigate to `/teacher/scoreboard`
3. Find a player's score for a round
4. Enter new score in override input
5. Click "Override"
6. **Expected**: 
   - Score updated
   - Round winner recalculated if needed
   - Match scores updated if round winner changed

#### Test 6.2.2: Override After Match End
1. Match ends (team reaches 5 points)
2. Try to override a score
3. **Expected**: Error message "Cannot override scores after match has ended"

---

### Test Suite 6.3: Match End & MVP

#### Test 6.3.1: Match Win Condition
1. Play rounds until one team reaches 5 round points
2. **Expected**: 
   - `MATCH_OVER` message broadcast
   - Match result displayed on student pages
   - Winner announced
   - MVP calculated (highest total evaluation score)

#### Test 6.3.2: Match Result Display
1. Match ends
2. **Student page**:
   - **Expected**: Match result modal/component
   - **Expected**: Final team standings
   - **Expected**: MVP displayed
   - **Expected**: Player's total evaluation score shown

#### Test 6.3.3: Final XP Awards
1. Match ends
2. Check `/profile` for winning team players
3. **Expected**: 
   - +20 XP for match winner
   - +10 XP for MVP (if player is MVP)
   - Total XP reflects all bonuses

---

## Integration Tests

### Test Suite I.1: Full Game Flow

#### Test I.1.1: Complete Match
1. **Setup**:
   - 1 teacher account
   - 3-4 student accounts (different browsers/incognito)
2. **Teacher**: Login, start round
3. **Students**: Login, join teams, submit answers
4. **Teacher**: End round, receive `ROUND_DATA`, submit scores
5. **Students**: See round results
6. **Repeat** until match ends (5 rounds)
7. **Verify**:
   - All XP awarded correctly
   - Match winner correct
   - MVP calculated correctly
   - All scores displayed correctly

#### Test I.1.2: Card Casting During Scoring
1. Round ends, teacher receives `ROUND_DATA`
2. Before teacher submits scores, student casts a card
3. **Expected**: Card effect applies (if valid)
4. Teacher submits scores
5. **Expected**: Round results still display correctly

---

## Edge Cases & Error Handling

### Test Suite E.1: Error Scenarios

#### Test E.1.1: Network Disconnection
1. Student disconnects during round
2. **Expected**: Reconnection handled gracefully
3. **Expected**: Team state preserved (if possible)

#### Test E.1.2: Teacher Disconnects
1. Teacher disconnects after round ends
2. **Expected**: Students see pending scoring state
3. Teacher reconnects
4. **Expected**: Can still submit scores for pending round

#### Test E.1.3: Multiple Score Submissions
1. Teacher submits scores for round
2. Try to submit scores again for same round
3. **Expected**: Either prevented or handled gracefully

#### Test E.1.4: Empty Answers
1. Round ends with some teams having no answer
2. Teacher receives `ROUND_DATA`
3. **Expected**: Empty answers shown as "(No answer)"
4. Teacher can still submit score (0) for empty answer

---

## Performance Tests

### Test Suite P.1: Load Testing

#### Test P.1.1: Multiple Students
1. Create 20+ student accounts
2. All join same match
3. **Expected**: 
   - No performance degradation
   - All messages received correctly
   - UI remains responsive

#### Test P.1.2: Rapid Rounds
1. Teacher starts and ends rounds quickly
2. **Expected**: 
   - No message loss
   - State remains consistent
   - XP awarded correctly for all rounds

---

## Regression Tests

### Test Suite R.1: Previous Features Still Work

#### Test R.1.1: Team System
- [ ] Students can create teams
- [ ] Students can join existing teams
- [ ] Writer/suggester roles work
- [ ] Suggestions can be inserted
- [ ] Writer can transfer role

#### Test R.1.2: Card System
- [ ] Cards can be cast
- [ ] Gold deducted correctly
- [ ] Effects apply (blur, shake, etc.)
- [ ] Card cast log updates

#### Test R.1.3: Answer Submission
- [ ] Writers can type answers
- [ ] Answers sync to server
- [ ] Answers appear on teacher page
- [ ] Lock functionality works

---

## Test Checklist Summary

### Quick Smoke Test (5 minutes)
- [ ] Register student account
- [ ] Login and access `/student`
- [ ] Teacher starts round
- [ ] Student submits answer
- [ ] Round ends, teacher submits scores
- [ ] Student sees results

### Full Regression Test (30 minutes)
- [ ] All Test Suite 5.1-5.4
- [ ] All Test Suite 6.1-6.3
- [ ] Test Suite I.1.1 (Complete Match)

### Pre-Release Test (1 hour)
- [ ] All test suites
- [ ] Edge cases
- [ ] Performance tests
- [ ] Multiple browser compatibility

---

## Test Data Management

### Creating Test Accounts
```bash
# Use registration UI or create directly in database
# For quick testing, use:
# Teacher: teacher@nist.ac.th / password123
# Students: 001@nist.ac.th, 002@nist.ac.th, etc.
```

### Clearing Test Data
```bash
# Clear all users
node server/scripts/clearUsers.js

# Get verification links
node server/scripts/getVerificationLink.js
```

---

## Notes

- **Always test in incognito mode** to avoid token/cache conflicts
- **Use different browsers** for teacher vs students
- **Clear database** between major test sessions
- **Check browser console** for errors during testing
- **Verify server logs** for unexpected errors
- **Test on different network conditions** if possible

---

## Reporting Issues

When reporting bugs, include:
1. Test case number (e.g., "Test 6.1.3")
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Browser/OS information
6. Server console errors (if any)
7. Browser console errors (if any)

