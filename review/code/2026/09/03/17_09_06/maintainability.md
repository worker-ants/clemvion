# 유지보수성(Maintainability) 리뷰

## 확인한 내용

리뷰 대상은 크게 세 그룹이다.

1. **엔티티 파일 9개**(`execution.entity.ts` · `knowledge-base.entity.ts` · `node-execution.entity.ts` ·
   `node.entity.ts` · `notification.entity.ts` · `schedule.entity.ts` · `trigger.entity.ts` ·
   `user.entity.ts` · `workflow.entity.ts`) — `nullable: true` 인 컬럼의 TS 타입을 `| null` 로
   넓히고 필요 시 `@Column({ type: ... })` 를 명시하는 기계적 정합화. 스크립트로 9개 파일
   전수를 재검사한 결과 **파일 내 비대칭(일부만 넓혀지고 일부는 안 넓혀진 것)은 0건** —
   plan 문서가 주장하는 "배치 2 가 술어로 닫힌다"는 실제로 달성돼 있다.
2. **`shared/utils/redact-stored-error.ts` / `.spec.ts`** — 위 타입 확장에 맞춰 제네릭 제약과
   시그니처를 넓히고, docstring 의 반증된 전제를 취소선 보존 방식으로 정정.
3. **`plan/in-progress/entity-nullable-column-type-mismatch.md`** 및 **이전 리뷰 라운드
   (`16_45_35`)의 산출물 13종**(`RESOLUTION.md`/`SUMMARY.md`/각 reviewer `.md`/`meta.json`/
   `_retry_state.json`) — 후자는 `review/code/**` 규약에 따른 정상 커밋 대상이며 내용 자체가
   생성 산출물이라 유지보수성 관점에서 별도 결함은 없다.

엔티티 필드 타입 확장은 전형적으로 반복적인 선언부 변경이라 함수 길이·중첩·순환 복잡도·
매직 넘버 문제가 발생할 여지가 원천적으로 없다. `redact-stored-error.ts` 의 함수들도
모두 5줄 이하로 짧고 단일 책임을 유지한다.

## 발견사항

- **[WARNING]** plan 문서의 새 H2 헤딩 앞에 빈 줄이 없다 — 그리고 이 결함은 **이전 리뷰
  라운드(`16_45_35`)에서 이미 지적됐고(`INFO#8`), `RESOLUTION.md` 는 "W2 정정에 포함됐다"고
  적었지만 실제로는 고쳐지지 않았다.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:170`(직전 본문 마지막 줄)
    ~`:171`(`## 배치 2 — 비대칭 해소 (완료)` 헤딩) — 둘 사이에 빈 줄 없음.
  - 상세: 같은 문서의 다른 모든 `##`/`###` 헤딩(실측 16개 중 15개)은 예외 없이 빈 줄 뒤에
    옵니다(`Read` 로 전문을 열어 `awk` 로 헤딩 직전 줄을 전수 대조해 확인). `## 배치 2` 만
    유일하게 본문 텍스트에 바로 붙어 있어 문서 내 일관성이 깨진다. 더 중요한 것은
    `review/code/2026/09/03/16_45_35/RESOLUTION.md:54`(`INFO#8 새 헤딩 앞 빈 줄 — W2 정정에
    포함됐다`)이 이 항목을 "조치 완료"로 분류하고 있는데, 대상 파일을 직접 열어 대조하면
    거짓이다. `SUMMARY.md` 의 다른 WARNING(W1~W4)은 실제로 반영돼 있었으므로(직접 대조 완료)
    이 항목만 국소적으로 새는 자리다.
  - 제안: `plan/in-progress/entity-nullable-column-type-mismatch.md:170` 다음에 빈 줄 1개
    추가. 아울러 향후 RESOLUTION 작성 시 "포함됐다"고 적은 항목은 커밋 전에 대상 파일을
    다시 열어 대조하는 절차를 권장한다(이번처럼 조용히 새는 사례가 있었다).

- **[INFO]** `redact-stored-error.ts` 의 `maskIfPresent` docstring 이 이번 라운드에서도
  더 길어졌다(반증 이력 문단 8줄 추가, 원문은 취소선 보존).
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` `maskIfPresent` 함수
    상단 JSDoc (약 40줄) vs 함수 본문 3줄.
  - 상세: 이전 리뷰(`16_45_35` INFO#9)에서 이미 관찰됐고 "즉시 조치 불요, 프로젝트의
    자기-반증형 소정정 관례에 부합"으로 처분됐다. 이번 라운드가 그 관례를 다시 정확히
    따랐으므로(원문 취소선 보존 + 반증 날짜·근거 병기) 회귀는 아니다. 다만 정정이 누적될
    때마다 함수 하나의 docstring 이 계속 자라는 추세는 그대로 유지되고 있어, 배치 3 종결
    시점에 "왜 이 가드가 필요한가"만 남기고 반증 이력은 plan 문서(단일 진실)로 옮기는
    정리를 고려할 만하다.
  - 제안: 조치 불요(기록 목적). 배치 3 완료 시 문서 분리 재검토.

- **[INFO]** 신규로 추가된 다중 라인 `@Column` 데코레이터 사이에 `nullable`/`length` 키
  순서가 파일마다 다르다.
  - 위치: `codebase/backend/src/modules/notifications/entities/notification.entity.ts:40-45`
    (`type` → `length` → `nullable` 순)와 `codebase/backend/src/modules/triggers/entities/trigger.entity.ts:62-67`
    (`type` → `nullable` → `length` 순), `codebase/backend/src/modules/users/entities/user.entity.ts:152-158`
    (`type` → `nullable` → `length` 순).
  - 상세: 두 순서 모두 이 diff 이전부터 저장소 전역에 이미 혼재해 있었다(`login-history.entity.ts`·
    `integration.entity.ts` 는 `type→length→nullable`, `user.entity.ts` 의 기존
    `passwordHash`/`twoFactorSecret` 등은 `type→nullable→length`) — 이번 diff 가 새로
    만든 불일치는 아니고 기존의 약한 컨벤션을 답습한 것뿐이다. 강제되는 린트 규칙도 없다.
  - 제안: 이번 PR 범위에서 조치 불요. 추후 `spec/conventions/` 에 TypeORM nullable 타이핑
    규약을 정식화할 때(이미 배치 2 SUMMARY INFO#11 로 이월됨) 키 순서 컨벤션도 함께 못박는
    것을 고려.

## 요약

핵심 변경(엔티티 9개 nullable 타입 정합화 + `redact-stored-error.ts` 시그니처 확장)은 반복적이고
기계적인 선언부 수정이라 가독성·네이밍·함수 길이·중첩·복잡도·중복 어느 축으로도 새로운 문제를
만들지 않으며, 스크립트로 9개 파일 전수를 재검사해 "파일 내 비대칭 0건"이라는 plan 의 완료
주장도 실측으로 확인된다. 유일한 실질적 결함은 `plan/in-progress/entity-nullable-column-type-mismatch.md`
의 새 헤딩 앞 빈 줄 누락이며, 이는 사소한 서식 문제 자체보다 **직전 라운드의 RESOLUTION.md 가
"조치 완료"로 잘못 기록**했다는 점에서 주목할 가치가 있다(다른 WARNING 3건은 실제로 반영돼
있었음을 직접 대조로 확인). `redact-stored-error.ts` 의 docstring 이 정정을 거듭하며 길어지는
추세와 `@Column` 키 순서 혼재는 회귀가 아닌 기존 관찰/기존 컨벤션의 연장이라 조치 불요로 판단한다.

## 위험도

LOW
