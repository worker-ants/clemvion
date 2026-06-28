# Code Review 통합 보고서 — ⚠️ STALE BASE (무효, 재실행으로 대체)

## 무효 사유
본 세션은 `--branch main` 으로 준비됐는데 **로컬 `main` 이 origin/main 보다 8 커밋 뒤처져**
있어 changeset 이 오염됐다 (`main..HEAD` = 294 files vs 실제 `origin/main..HEAD` = 12 files).
그 결과 다른 이미-머지된 PR(#762 webhook 1MB, channel-web-chat, error-handling 등)의
변경이 본 PR diff 로 잘못 포함됐다.

따라서 아래 원 보고서의 WARNING 중 **W1(i18n tokenExpiresAuto)·W2(spec §4.1/§4.2)·
W4(HOOKS_MAX_BODY_BYTES .env)·W5(triggers.mdx)** 및 다수 INFO 는 **본 PR 변경과 무관**하다.
본 PR 실제 변경(4 code files)에 해당하는 항목은 **W3(excludeAutoRefresh 헬퍼 vs 인라인)**
뿐이다.

**→ 올바른 base(`--branch origin/main`)로 재실행한 세션의 SUMMARY/RESOLUTION 이 본
세션을 대체한다.** (memory: "리뷰 diff base: stale 로컬 main 주의")

---

## 원 보고서 (참고용, base 오염)

전체 위험도 MEDIUM / Critical 0 / Warning 5. 위 무효 사유에 따라 W1/W2/W4/W5 는 타 PR
소속. W3 만 본 PR 대상:

- **W3 (Maintainability)**: `attention` 분기 connected 서브조건이 `excludeAutoRefresh`
  헬퍼 대신 인라인 문자열(`autoRefreshExclusion`)로 구현 — 동일 로직 두 경로 혼재.
  위치: `integrations.service.ts` attention 분기.

- INFO-3 (google §9.1↔§11.1 비대칭), INFO-5 (Rationale l.1194 makeshop 누락): 본 PR 범위
  밖 spec 항목 — project-planner 후속 (impl-prep W-1 과 동일, 별도 이관).
