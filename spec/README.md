# spec/ — NERV 스펙 미러 (읽기 전용)

이 폴더의 `CLE-*` 파일은 NERV 스펙의 사본이다. **정본은 NERV 다.** 손으로 고치지 않는다.
`.claude/hooks/guard_nerv_owned_paths.py` 가 편집을 막고, CI `spec-mirror-integrity` 가
본문 지문(`mirror_sha256`)이 어긋난 파일을 잡는다.

- 스펙을 고칠 때: `/nerv:spec edit <KEY>` 로 NERV 초안을 쓰고 사람이 승인한다.
- 미러를 갱신할 때: 구현하는 세션이 클레임한 스펙을 받아 코드와 같은 PR 에 커밋한다.
  `python3 .claude/tools/nerv-mirror/pull.py --task <CLE-T-…>`
- 전체를 다시 받을 때: `python3 .claude/tools/nerv-mirror/pull.py --all`
- 미러는 구현된 스펙의 스냅샷이다. 최신본은 NERV 에서 읽는다.
- 카탈로그(`CLE-C24` · `CLE-MKS`)는 미러하지 않는다. 정본은 codebase 데이터다.

## 영역

- [CLE-ACCT](CLE-ACCT/CLE-ACCT.md)
- [CLE-AI](CLE-AI/CLE-AI.md)
- [CLE-API](CLE-API/CLE-API.md)
- [CLE-CHAT](CLE-CHAT/CLE-CHAT.md)
- [CLE-ENG](CLE-ENG/CLE-ENG.md)
- [CLE-EXEC](CLE-EXEC/CLE-EXEC.md)
- [CLE-INT](CLE-INT/CLE-INT.md)
- [CLE-IX](CLE-IX/CLE-IX.md)
- [CLE-KB](CLE-KB/CLE-KB.md)
- [CLE-NODE](CLE-NODE/CLE-NODE.md)
- [CLE-NODE-AI](CLE-NODE-AI/CLE-NODE-AI.md)
- [CLE-NODE-DATA](CLE-NODE-DATA/CLE-NODE-DATA.md)
- [CLE-NODE-FLOW](CLE-NODE-FLOW/CLE-NODE-FLOW.md)
- [CLE-NODE-INT](CLE-NODE-INT/CLE-NODE-INT.md)
- [CLE-NODE-LOGIC](CLE-NODE-LOGIC/CLE-NODE-LOGIC.md)
- [CLE-NODE-PRES](CLE-NODE-PRES/CLE-NODE-PRES.md)
- [CLE-NODE-TRIG](CLE-NODE-TRIG/CLE-NODE-TRIG.md)
- [CLE-OBS](CLE-OBS/CLE-OBS.md)
- [CLE-PLAT](CLE-PLAT/CLE-PLAT.md)
- [CLE-RESEARCH](CLE-RESEARCH/CLE-RESEARCH.md)
- [CLE-TRIG](CLE-TRIG/CLE-TRIG.md)
- [CLE-UI](CLE-UI/CLE-UI.md)
- [CLE-WEBCHAT](CLE-WEBCHAT/CLE-WEBCHAT.md)
- [CLE-WF](CLE-WF/CLE-WF.md)

## 영역 밖 문서

- [CLE-GLOSSARY](CLE-GLOSSARY.md)
- [CLE-VISION](CLE-VISION.md)
