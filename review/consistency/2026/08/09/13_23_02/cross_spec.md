# Cross-Spec 일관성 검토 — target: spec/7-channel-web-chat/ (impl-done)

## 검토 범위 확인

`git diff origin/main...HEAD -- code_areas`(스코프 = `spec/7-channel-web-chat/` 의 `code:` 프런트매터가 가리키는
영역)로 프롬프트에 첨부된 실제 변경분은 다음 2줄뿐이다:

```diff
codebase/channel-web-chat/package.json:  "dompurify": "3.4.12"  →  "3.4.13"
codebase/frontend/package.json:          "dompurify": "^3.4.12" → "^3.4.13"
```

작업 워크트리(HEAD, 절대경로 `/Volumes/project/private/clemvion/.claude/worktrees/ci-required-check-skip-jobs-42f5d8`)에서
`git diff origin/main...HEAD --stat -- codebase/channel-web-chat/ codebase/frontend/` 로 재확인해도 동일 — 이
2개 파일, 2줄 변경이 전부다. 관련 커밋(`366affde2 fix(deps): 새로 도는 audit 이 드러낸 main 취약점 2건 해소 —
nanoid high · dompurify moderate`)도 채널-웹챗 기능이 아닌 **의존성 보안 패치**(dompurify moderate CVE 해소)임을
확인했다. `spec/7-channel-web-chat/` 아래 6개 문서(1-widget-app·2-sdk·3-auth-session·4-security·
0-architecture·5-admin-console·_product-overview) 어디에도 이 diff 에 대응하는 엔티티·API·상태·권한·계층
서술 변경은 없다 — target spec 문서 자체도 이번 diff 로 갱신되지 않았다(`git diff --stat -- spec/7-channel-web-chat/`
결과 없음, 별도 확인).

## 발견사항

관점 1~6(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 전부에서 대상 diff 가 접촉하는 표면이 없다.

- 데이터 모델: 변경 없음 (package.json 버전 필드만 수정)
- API 계약: 변경 없음
- 요구사항 ID: 신규 ID 없음
- 상태 전이: 변경 없음
- RBAC: 변경 없음
- 계층 책임: 변경 없음

`spec/7-channel-web-chat/4-security.md` §1.1 이 위젯 sanitize 라이브러리로 `marked` + `DOMPurify` 를 명시하고,
동봉된 `package.json` 주석("exact pin 사유(PROJECT.md §버전 핀 정책): dompurify·marked = sanitize 경로(공급망
무결성)")이 `codebase/channel-web-chat/package.json` 에서 dompurify 를 **캐럿 없이 exact pin** 하도록 요구한다.
이번 diff(`"3.4.12"` → `"3.4.13"`, 캐럿 없음)는 이 exact-pin 정책을 그대로 유지하며 patch 버전만 올린 것이라 —
**정책과 정합**하고 충돌이 없다. `codebase/frontend/package.json` 의 caret 표기(`^3.4.12` → `^3.4.13`)는 diff 이전부터
존재하던 표기 방식이며(변경분은 patch 숫자뿐), 이 caret 정책은 채널-웹챗 exact-pin 요구(공급망 무결성 목적)와
적용 대상 패키지가 달라 상충하지 않는다 — WARNING/CRITICAL 사유 없음, 관찰용 INFO 로도 신규 이슈는 아님(기존
비대칭이며 이번 diff 가 만든 것이 아님).

발견된 CRITICAL/WARNING/INFO 없음.

## 요약

이번 impl-done 검토의 실제 diff 는 `dompurify` 패치 버전 업(보안 취약점 해소, 커밋 366affde2)만을 포함하며
`spec/7-channel-web-chat/` 이 정의하는 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 것도
건드리지 않는다. `4-security.md` 가 요구하는 dompurify exact-pin 정책과도 정합한다. 따라서 다른 spec 영역과의
충돌 가능성은 없다.

## 위험도

NONE
