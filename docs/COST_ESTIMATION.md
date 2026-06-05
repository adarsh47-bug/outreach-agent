# Cost Estimation — V3

Running the Outreach Agent V3 is designed to be **near-zero cost** for personal job search use.

---

## 1. AI Usage Pattern (V3 Cost-Efficient Strategy)

Gemini is called **only** for 5 operations:

| Operation | When | Approx. tokens |
|---|---|---|
| Resume parse | Once per resume upload | ~2,000 input, ~500 output |
| Company enrich | Once per contact at campaign launch | ~800 input, ~400 output |
| Email generation | Once per contact at campaign launch | ~1,200 input, ~150 output |
| Reply classification | Once per email reply received | ~600 input, ~100 output |
| Daily report | Once per day | ~500 input, ~300 output |

**Campaign of 25 contacts:**
- 25 enrichments + 25 email generations + 1 report ≈ ~75,000 tokens total
- At Gemini Flash free tier: **$0.00**
- At paid tier ($0.075/1M input, $0.30/1M output): **~$0.03–$0.08**

---

## 2. Full Cost Breakdown

| Service | Free Tier Limit | Typical Monthly Usage | Estimated Cost |
|---|---|---|---|
| **Gemini Flash** | 15 RPM, 1M TPM (free key) | ~200K tokens/month (2 campaigns) | **$0.00** (free tier) |
| **Cloud Firestore** | 50K reads, 20K writes/day | ~5K writes/day during campaign | **$0.00** (free tier) |
| **Firebase Auth** | Unlimited for Google Sign-In | 1 user | **$0.00** |
| **Gmail API** | Unlimited (user's own account) | 8–12 emails/day | **$0.00** |
| **Cloud Run** (if deployed) | 2M CPU-seconds/month | ~200K CPU-seconds | **$0.00** (free tier) |

**Total estimated monthly cost: $0.00 – $0.10**

---

## 3. Pay-As-You-Go (If Free Tiers Exceeded)

### Gemini Flash (Paid API)
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens
- 10 campaigns × 25 contacts = 750K tokens → **~$0.25/month**

### Firestore (Paid Tier)
- Writes: $0.06 per 100K operations
- Reads: $0.018 per 100K operations
- Heavy usage (1,000 contacts/month): **< $0.50/month**

---

## 4. Gmail Safe Sending Limits

| Configuration | Limit |
|---|---|
| Recommended daily limit | 8–12 emails |
| Maximum daily limit | 20 emails |
| Monthly (at 10/day, 22 weekdays) | 220 emails |
| Gmail personal account safe limit | ~500/day |

Staying at 8–12/day ensures zero spam risk and healthy deliverability.

---

## 5. Summary

For personal job search (1 user, 2–4 campaigns/month, 25–100 contacts each):

**Total monthly cost: effectively $0**

Using the free Gemini API key, Firebase Spark plan (free), and Gmail API (free with OAuth), the platform runs at zero infrastructure cost until you're scaling to hundreds of campaigns.
