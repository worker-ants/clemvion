# Plan 정합성 검토 — `plan/in-progress/lockfile-libc-pin.md`

## 검토 범위

- Target: `plan/in-progress/lockfile-libc-pin.md` (신규, status: in-progress, 커밋 전)
- 대조 대상: `plan/in-progress/` 전체(대부분 컨텍스트 예산으로 절단됨). `packageManager|pnpm@|Dockerfile.playwright-e2e|libc:|frozen-lockfile|action-setup` grep 으로 실제 겹치는 문서 3건만 전문 확인:
  - `plan/in-progress/deps-guard-hardening.md` §"후속 — lockfile `libc:` 필드가 커밋마다 진동한다"
  - `plan/in-progress/spec-draft-nullable-notation-followups.md` (line ~5197 항목)
  - target 자신
- 코드베이스 대조: `package.json`(`packageManager: pnpm@10.23.0`, 미변경 확인), `codebase/frontend/Dockerfile.playwright-e2e`(하드코딩 폴백 `pnpm@10.23.0`, 미변경), `codebase/{frontend,backend}/Dockerfile`(둘 다 `corepack enable`만, 버전 리터럴 없음), `.github/workflows/*`(`pnpm/action-setup@v6.1.0` — `version:` 미지정이라 `packageManager` 를 읽음). target 이 §B 표에서 주장한 "corepack(Dockerfile 셋) · action-setup(CI) · 로컬 자동전환 · dependabot 모두 이 값을 읽는다, 하드코딩 폴백은 1곳뿐"은 실측과 일치한다 — 3개 Dockerfile 중 버전 리터럴을 가진 곳은 `Dockerfile.playwright-e2e` 하나뿐이고 이것만 target 이 고친다.

## 발견사항

- **[INFO]** 재설계된 회귀 가드 체크박스를 실행 시 원문 없이 덮어쓸 위험
  - target 위치: `plan/in-progress/lockfile-libc-pin.md` §B "가드를 새로 세우지 않는 이유" + §C 검증 마지막 체크리스트("트래커 항목 닫기 + `deps-guard-hardening.md` 두 체크박스 갱신")
  - 관련 plan: `plan/in-progress/deps-guard-hardening.md` §후속 의 두 번째 체크박스 — "(b) 채택 시 동반: lockfile `libc:` **개수** 회귀 가드"
  - 상세: 그 체크박스는 "개수" 비교를 가드 설계로 못박아 두었다. target 은 §B 에서 이 설계가 틀렸다고 판단하고("의존성을 빼면 정당하게 줄어든다") 새 불변식("base·head 둘 다 있는 `name@version` 엔트리의 `os`·`cpu`·`libc` 일치")을 제시한 뒤, CI 에 base lockfile 을 가져오는 잡이 필요해 이번 PR 은 설계만 그 절에 적고 체크박스는 열어 두겠다고 명시했다 — 판단 자체는 타당하고 결론(열어 둠)도 맞다. 다만 실행 문구가 "갱신" 한 마디뿐이라, 같은 문서가 이미 확립한 관례(같은 절 안에서 이전 전제를 `~~취소선~~` + 블록쿼트로 정정하며 이력을 보존하는 방식, 2026-09-10 항목 참고)를 따르라는 지시가 target 에 없다. 원문("개수" 기준)을 그냥 새 문장으로 치환하면 "왜 개수에서 엔트리-일치로 바뀌었는가"의 근거가 사라진다.
  - 제안: target §C 체크리스트 마지막 항목에 "deps-guard-hardening.md 둘째 체크박스는 원문(개수 기준)을 취소선으로 남기고 새 설계를 그 아래 인용으로 추가, 체크박스는 `[ ]` 유지"라고 구체화. plan 자체 수정이 아니라 실행 시 유의사항이라 WARNING 이 아닌 INFO.

- **[INFO]** "트래커 항목 닫기" 문구가 두 트래커·두 체크박스의 서로 다른 처분을 한 줄로 뭉갠다
  - target 위치: `plan/in-progress/lockfile-libc-pin.md` §C 검증, 마지막 체크리스트 항목
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` line 5197 developer 항목(2026-09-24 등재) + `plan/in-progress/deps-guard-hardening.md` §후속(2026-08-09 등재)의 두 체크박스
  - 상세: 두 트래커가 같은 결함을 서로 다른 날짜에 독립적으로 등재했고, target 은 본문 서두에서 이를 정확히 인지해 "이 PR 이 그것이다"라고 양쪽을 함께 겨냥한다 — 교차 인지 자체는 잘 됐다. 그런데 실행 체크리스트는 "트래커 항목 닫기"(단수) + "두 체크박스 갱신"으로만 적혀 있어, 실제로는 처분이 세 갈래(nullable-notation-followups 항목 닫기 / deps-guard-hardening 첫 체크박스 `[x]` / 둘째 체크박스는 설계만 갱신하고 `[ ]` 유지)라는 것이 문구에 드러나지 않는다. 실행자가 편의상 둘째 체크박스까지 함께 체크해 버리면, "가드는 아직 구현 안 됨"이라는 사실이 조용히 사라진다.
  - 제안: 체크리스트 항목을 세 갈래로 분리해 적어 두면 실행 시 오체크를 방지할 수 있다. (target 자체를 지금 수정하라는 CRITICAL/WARNING 이 아니라, 실행 전 참고용 메모.)

미해결 결정 우회(CRITICAL 대상)는 발견되지 않았다 — `deps-guard-hardening.md` §후속이 "(b)(핀 상향)는 별도 PR 로 판단하라"고 명시적으로 위임한 결정을 target 이 그대로 이어받아 실행하는 구조이고, target 의 §A 측정(‘메타데이터 모드’가 원인이지 pnpm 버전 자체 불일치가 아니다)은 두 트래커의 잘못된 전제를 실측으로 교정하는 내용이지 임의로 새 결정을 얹는 것이 아니다. 선행 plan 미해소(WARNING 대상)도 없다 — target 이 가정하는 사전조건("(b)의 전제 실증")은 `deps-guard-hardening.md` 2026-09-10 블록쿼트에서 이미 충족된 상태로 기록돼 있고, target §A-3 이 그 위에서 한 단계 더 나아가 "핀을 올린 뒤에도 수렴하는가"까지 확인했다.

## 요약

target plan 은 두 개의 독립 트래커(`deps-guard-hardening.md` 2026-08-09, `spec-draft-nullable-notation-followups.md` 2026-09-24)가 추적해 온 같은 결함을 정확히 식별하고, 전자가 명시적으로 위임한 "별도 PR 판단" 요청에 응답하는 구조로 짜여 있다. 코드베이스 대조(package.json·3개 Dockerfile·CI action-setup) 결과 target 의 처방 범위(파일 2곳)는 실제 하드코딩 지점과 정확히 일치했고, 미해결 결정을 우회하거나 선행 조건을 건너뛴 지점은 없었다. 유일한 약점은 후속 체크박스 처분(가드 설계 교체를 원문 보존 없이 덮어쓸 위험, 두 트래커·세 갈래 처분을 한 문구로 뭉갠 것)의 실행 디테일이 target 문서에 충분히 구체화돼 있지 않다는 점이며, 둘 다 실행 전 참고 메모 수준의 INFO 다.

## 위험도

LOW
