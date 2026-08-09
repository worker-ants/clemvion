# Rationale 연속성 검토 — spec/7-channel-web-chat/

## 검토 범위 확인

- 검토 모드: `--impl-done`, scope=`spec/7-channel-web-chat/`, diff-base=`origin/main`
- target spec 영역(`spec/7-channel-web-chat/`) 자체는 이번 diff 에서 **변경되지 않았다** (bundle 에 포함된 7개 spec 파일은
  모두 기존 내용 그대로이며, 각 파일의 `## Rationale` 섹션도 이전과 동일).
- `code_areas` 로 필터링된 실제 diff(`git diff origin/main...HEAD -- code_areas`)는 다음 한 줄뿐이다:

  ```diff
  --- a/codebase/channel-web-chat/package.json
  +++ b/codebase/channel-web-chat/package.json
  -    "dompurify": "3.4.12",
  +    "dompurify": "3.4.13",
  ```

  (원본 커밋 로그 확인 결과 `fix(deps): 새로 도는 audit 이 드러낸 main 취약점 2건 해소 — nanoid high · dompurify moderate` —
  `npm audit` 이 드러낸 보안 취약점 해소를 위한 patch 버전(3.4.12→3.4.13) 업그레이드이며, `frontend/package.json` 의 동일
  bump 는 `spec/7-channel-web-chat/` 코드 영역 밖이라 이번 scope 밖.)

## 발견사항

없음.

- **기각된 대안의 재도입** — 해당 없음. spec 본문·Rationale 변경 없음.
- **합의된 원칙 위반** — 해당 없음. `4-security.md` R4("마크다운 sanitize — deny-by-default allowlist, blacklist 기각")는
  DOMPurify 의 `ALLOWED_TAGS`/`ALLOWED_ATTR`/`ALLOWED_URI_REGEXP` **구성 방식**에 대한 결정이며, 이번 diff 는 그 구성을
  건드리지 않고 라이브러리 patch 버전만 올린다 — R4 의 결정과 무관·비충돌.
  `package.json` 의 `//pin` 주석("exact pin 사유: dompurify·marked = sanitize 경로 공급망 무결성")이 요구하는 **exact
  pin**(caret 없는 고정 버전) 형식도 diff 후 그대로 유지된다(`3.4.13`, caret 없음) — pin 정책과도 정합.
- **결정의 무근거 번복** — 해당 없음. 번복된 결정 없음(라이브러리 버전 bump 는 spec 결정이 아님).
- **암묵적 가정 충돌** — 해당 없음. `0-architecture.md`/`4-security.md` 의 iframe 격리·CORS·sandbox 관련 invariant 는
  이번 diff 와 무관.

## 요약

이번 리뷰 scope(`spec/7-channel-web-chat/` 관련 코드 영역)에 대한 실질 diff 는 `codebase/channel-web-chat/package.json`
의 `dompurify` patch 버전 업그레이드(3.4.12→3.4.13, npm audit 취약점 해소) 한 줄뿐이며, spec 문서 자체는 변경되지
않았다. 이 변경은 `4-security.md` R4(sanitize deny-by-default allowlist)의 구성 방식이나 `//pin` exact-pin 정책 어느
쪽과도 충돌하지 않고, 다른 Rationale 항목(R1~R10, R1~R6 등)이 다루는 결정 어느 것도 재도입·번복하지 않는다. Rationale
연속성 관점에서 이번 diff 는 검토 대상이 되는 설계 결정을 포함하지 않는 순수 의존성 패치다.

## 위험도

NONE
