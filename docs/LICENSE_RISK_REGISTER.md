# License Risk Register

This register is not legal advice. It records engineering risk for a proprietary or closed-source local desktop app path.

| Repo | License Status | Compatibility | Can Copy Code? | Attribution Required? | Source Disclosure Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| Narcooo/inkos | AGPL-3.0-only | High risk for proprietary app | No, unless user accepts AGPL obligations | Yes if used | Yes, AGPL obligations may be triggered by derivative work and network use | Architecture only |
| xindoo/ai-novel-lab | MIT | Compatible | Yes, with review | Yes, preserve copyright/license | No copyleft disclosure | Adapt with attribution; avoid manuscript copying |
| PenglongHuang/chinese-novelist-skill | No detected license; README badge claims MIT but no license file in clone | Unclear | No until license clarified | Unknown | Unknown | Reference only |
| Deng-m1/MaliangAINovalWriter | Apache-2.0 with NOTICE | Compatible | Yes, with review | Yes, preserve license and NOTICE | No copyleft disclosure | Adapt with attribution |
| langchain-ai/story-writing | No detected license | Unclear | No | Unknown | Unknown | Architecture only |
| THUDM/LongWriter | Apache-2.0 | Compatible | Yes, with review | Yes, preserve license/notice where applicable | No copyleft disclosure | Adapt with attribution |
| openai/codex | Apache-2.0 with NOTICE | Compatible for code, not branding | Legally yes, practically avoid | Yes, preserve license and NOTICE | No copyleft disclosure | Architecture only; do not copy branding |
| langchain-ai/langgraphjs | MIT | Compatible | Yes, with review | Yes, preserve copyright/license | No copyleft disclosure | Use as dependency |

## Risk Notes

AGPL/GPL:

- Do not copy AGPL/GPL source or prompt assets into WenForge.
- Do not port close translations of AGPL code.
- Architecture concepts are acceptable when independently implemented.

No license:

- Public visibility is not permission to reuse.
- Treat as reference only.
- If an upstream license is later added, pin the commit and confirm the license applies to the inspected content.

MIT/Apache-2.0:

- Reuse is generally compatible with a proprietary/local desktop app.
- Keep attribution and license notices.
- Apache-2.0 also has patent grant and NOTICE obligations.

Branding:

- OpenAI/Codex names, logos, screenshots, and proprietary product identity must not be copied.
- WenForge should use its own naming, iconography, palette, and interaction copy.

