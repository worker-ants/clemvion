STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
### 발견사항

없음.

이번 변경 set(53개 파일)은 backend `sanitize-error-message.ts` 와 frontend `lib/utils/masked-markers.ts` 에
손으로 복제돼 있던 마스킹 마커 상수(`MASKED_MARKERS`/`isMaskedMarker`/`MAX_MASK_DEPTH` 등)를
신규 공유 패키지 `@workflow/masked-markers` 로 추출하는 내부 리팩터다. 양쪽은 이제 그 패키지를
재export 하는 shim 이고 동작 변화는 없다. `.claude/config/doc-sync-matrix.json` 의 `rows[]` (22행)
+ `PROJECT.md` §변경 유형 → 갱신 위치 매핑을 대조한 결과:

- **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — 매칭 없음. 변경 파일은
  `shared/utils/`, `repo-guards/`, `packages/masked-markers/` 이며 nodes 디렉터리 밖.
- **신규 UI 문자열 (TSX)** (`codebase/frontend/src/**/*.tsx`, semantic) — 매칭 없음. frontend 변경은
  전부 `.ts` (`lib/utils/masked-markers.ts`, `lib/repo-guards/__tests__/*`) 이고 신규 텍스트는 전부
  개발자용 한국어 JSDoc/주석이지 사용자에게 렌더되는 문자열이 아니다. `.tsx` 파일 변경 자체가 없다.
- **통합/제공자 변경** — 매칭 없음. provider 관련 코드 없음.
- **유저 가이드 신규 섹션 디렉토리** (`codebase/frontend/src/content/docs/*/`) — 매칭 없음. `content/docs/`
  하위 변경 없음.
- **인증·권한·세션 흐름 변경** (`codebase/backend/src/modules/auth/**`) — 매칭 없음.
- **표현식 언어 변경** (`codebase/packages/expression-engine/**`) — 매칭 없음. 신규 패키지는
  `codebase/packages/masked-markers/**` 로 별개 패키지.
- **실행·디버깅 흐름 변경** — 매칭 없음. `sanitize-error-message.ts` 는 egress 마스킹 유틸이고
  이번 변경은 상수 출처만 바뀌었지(re-export) 마스킹 판정 로직·실행 엔진 흐름은 그대로다.
- **신규 warningCode/errorCode 발행** (`error-codes.ts` / warningRules) — 매칭 없음. `error-codes.ts`
  변경 없고, 사용자 노출 에러 메시지·코드도 추가되지 않았다.
- **spec 신규/대규모 변경** (`spec/5-*/**`) — `spec/5-system/14-external-interaction-api.md` 가 이 행에
  glob 매칭된다. 다만 diff 를 직접 확인하면 이 행이 요구하는 동반 갱신(frontmatter `code:` 글로브
  갱신 · `status`/`pending_plans` 정합)이 **같은 diff 안에서 이미 이행돼 있다** — `code:` 리스트에
  `codebase/packages/masked-markers/src/index.ts` 가 추가됐고, `status: partial` /
  `pending_plans: [plan/in-progress/spec-sync-external-interaction-api-gaps.md]` 는 변경 전과
  일관되게 유지된다. 본문도 "SoT 는 공유 패키지" 로 정확히 갱신됐다. 이 행은 "유저 가이드"
  (frontend docs MDX) 대상이 아니라 spec 내부 frontmatter 정합 행이며, 갭 없음.

`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 도 같은 diff 안에서 해당 백로그
항목 두 건을 `[x]` 로 닫아 plan 서술과 실제 상태가 일치한다(체크박스=실제 상태 원칙 충족).

### 요약

매트릭스 22개 trigger 행 중 glob/semantic 매칭이 확인된 행은 `spec-major-change` 1건뿐이며, 그
행이 요구하는 동반 갱신(frontmatter `code:`/`status`/`pending_plans`)은 diff 안에서 이미 이행돼
누락이 없다. 노드·UI 문자열·통합·문서 섹션·auth·표현식 언어·실행/디버깅·warning/error code 등
"유저 가이드"(docs MDX·i18n dict·backend-labels) 관련 8개 관점은 전부 무관 — 이번 변경은 내부
마스킹 마커 상수를 공유 패키지로 추출하는 리팩터로, 사용자 대면 문자열·문서·노드 스키마에
아무 영향이 없다. 누락 0건.

### 위험도

NONE
