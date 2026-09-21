# 정식 규약 준수 검토 — spec/2-navigation (--impl-done)

## 조사 방법 메모

`_prompts/convention_compliance.md` 번들은 컨텍스트 예산 초과로 `spec/2-navigation` 18개 파일 중
다수(`4-integration.md`·`6-config.md`·`_product-overview.md`·`_layout.md` 등)와 `## 구현 변경 사항`
diff 본문 자체가 "본문 생략됨" 플레이스홀더로 대체돼 있었다. 번들 지시대로 저장소 실제 파일을 절대경로로
직접 대조했다:

- `git -C <worktree> diff origin/main...HEAD --stat` 로 실제 코드 diff 를 확인 — scope 표기(`3개 파일 /
  316줄`)와 raw diff 라인 수가 정확히 일치함을 재검증(`git diff ... -- <3 files> | wc -l` = 316).
- 코드 diff 대상은 `codebase/backend/src/modules/model-config/model-config.service.ts` /
  `model-config.service.spec.ts` / `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts` 셋
  — 이 3파일은 `spec/2-navigation/6-config.md` frontmatter `code:` 의
  `codebase/backend/src/modules/model-config/**` 글로브가 무는 영역이다(`spec/2-navigation` 델타 0개
  파일이라는 전제와 모순되지 않는다 — glob 매칭 코드 영역이 바뀐 것이지 spec 문서 자체는 바뀌지 않았다).
- 대조한 정식 규약: `spec/conventions/error-codes.md`(전문) · `audit-actions.md`(전문) ·
  `spec-impl-evidence.md`(전문, R-1) · `swagger.md` 관련 절.
- 직전 `--impl-prep` 라운드(`review/consistency/2026/09/21/16_16_35/convention_compliance.md`)가 이미
  같은 target 문서를 저장소 원본으로 대조해 두 INFO 를 남겼다 — 이번 PR 이 그 두 파일(`14-execution-history.md`·
  `6-config.md`)을 건드리지 않았으므로 상태가 그대로임을 재확인만 하고 아래에 캐리포워드했다.

## 발견사항

### [INFO] `14-execution-history.md` 날짜 없는 bare 리뷰 인용 (캐리포워드, 이번 PR 무관)

- target 위치: `spec/2-navigation/14-execution-history.md:479` — `` `10_53_52` security/architecture W2·W3 ``
- 위반 규약: `spec/conventions/review-citations.md` §2·§3 — `spec/**` 문서의 리뷰 인용은 날짜 없는 bare
  `hh_mm_ss` 형태를 금지.
- 상세: 직전 라운드(16_16_35)에서 이미 지적된 기존 상태이며, 이번 diff(`model-config.service.ts` 등
  3파일)는 이 파일을 전혀 건드리지 않는다. §4 grandfather 조항이 "기존 bare 인용은 소급 정리 대상이
  아니다" 라고 명시하므로 차단 사유가 아니다.
- 제안: 이번 PR 범위 밖. 다음에 그 절 인근을 편집하는 사람이 날짜를 채우도록 등재만 유지.

### [INFO] `6-config.md` 단독 `## Overview (제품 정의)` 헤딩 비대칭 (캐리포워드, 이번 PR 무관)

- target 위치: `spec/2-navigation/6-config.md:21`
- 위반 규약: `.claude/skills/project-planner/SKILL.md` §Spec 문서 구조 — 다중 파일 영역은 제품 정의를
  `_product-overview.md` 에 두고 개별 화면 spec 은 로컬 Overview 헤딩을 두지 않는 것이 정칙(형제
  `1-workflow-list.md`/`2-trigger-list.md`/`3-schedule.md` 는 헤딩 없음).
- 상세: 직전 라운드에서 이미 등재된 기존 비대칭이며, 이번 코드 변경(model-config 삭제 동시성)은
  `6-config.md` 본문을 전혀 편집하지 않는다. 내용 자체는 `_product-overview.md` 요구사항 표를
  중복하지 않는 1문단 서문이라 실질 충돌은 없다.
- 제안: 차단 사유 아님. 이 파일을 다음에 편집할 때 헤딩을 비-Overview 명칭으로 바꾸거나 SKILL.md 에
  "화면별 1문단 소개는 로컬에 둘 수 있다" 는 예외를 명문화하는 쪽을 검토.

## 준수 확인 — 실제 구현 diff (3파일 / 316줄)

이번 PR 이 `spec/2-navigation` 문서 자체를 바꾸지 않으므로, 정식 규약 준수의 핵심 쟁점은 "diff 가 새로
도입한 명명·출력 형태가 이미 SoT 화된 규약과 어긋나는가" 다. 대조 결과 위반 없음:

- **에러 코드** ([`error-codes.md`](../../../../../../spec/conventions/error-codes.md) §1·§3):
  diff 는 새 에러 코드를 신설하지 않는다. `remove()` 가 동시 삭제 진 쪽에서 던지는 코드는 기존
  `private notFound()` 헬퍼(= `findEntity` 조회 실패와 동일 `MODEL_CONFIG_NOT_FOUND`, 404)를 그대로
  재사용한다 — §3 예외 레지스트리에도 없고 §5 rename 대상도 아닌, 이미 안정화된 코드의 정합적 재사용이다.
- **감사 액션 명명** ([`audit-actions.md`](../../../../../../spec/conventions/audit-actions.md) §2.2·§3):
  `AUDIT_ACTIONS.MODEL_CONFIG_DELETE`(`model_config.delete`)는 레지스트리의 `model_config` 행(현재형
  §2.2, `create`/`update`/`delete`/`set_default`)과 정확히 일치하는 기존 상수를 그대로 쓴다 — 신규 액션
  추가 없음.
- **spec-impl-evidence** ([`spec-impl-evidence.md`](../../../../../../spec/conventions/spec-impl-evidence.md)
  R-1): 신규 e2e 파일 `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts` 는
  `6-config.md` `code:` 의 어떤 글로브에도 매칭되지 않지만, R-1 이 "글로브 허용 — 명시 파일 강제 아님"
  을 원칙으로 명시하고 `status: implemented` 가드는 ≥1 매치만 요구한다(이미 서비스 파일로 충족). 형제
  결함 클래스 7건(`workflow`/`workspace`/`trigger`/`schedule`/`integration`/`auth-config`-delete-concurrency,
  `member-remove-concurrency`) 의 e2e 파일도 전수 `spec/**` grep 0건으로 **동일하게** 미등재라, 이번
  파일만의 이탈이 아니라 기존 프로젝트 관행과 일치한다.
- **파일 명명**: `model-config-delete-concurrency.e2e-spec.ts` 는 위 형제 7개와 동일한
  `<resource>-{delete,remove}-concurrency.e2e-spec.ts` 패턴을 그대로 따른다.
- **금지 패턴**: `spec/conventions/` 전체에 이 삭제 경로에 advisory lock 을 강제하는 규약은 없다 —
  diff 의 주석이 스스로 밝히듯 형제 7건과 같은 "락 신설 없이 원자적 `DELETE` + `affected` 명시 비교"
  설계를 재사용한 것으로, 기존 관행의 반복이지 신규 위반이 아니다.
- **Swagger/DTO**: 이번 diff 는 컨트롤러·DTO 를 건드리지 않아 `swagger.md` 데코레이터 패턴 적용 대상
  자체가 없다.

## 요약

target 문서(`spec/2-navigation`)는 이번 PR 에서 델타 0으로 확인되며, PR 이 실제로 건드린 코드
(`ModelConfigService.remove()` 의 동시-삭제 원자화, 3파일/316줄)는 `spec/conventions/error-codes.md`
·`audit-actions.md`·`spec-impl-evidence.md` 어느 축에서도 신규 명명·신규 예외를 만들지 않고 기존
SoT 상수(`MODEL_CONFIG_NOT_FOUND`, `model_config.delete`)를 그대로 재사용하며, 형제 결함 클래스
7건과 동일한 e2e 파일 명명·미등재 관행을 따른다. CRITICAL/WARNING 급 위반은 발견되지 않았다. 유일한
발견사항 2건은 이번 diff 가 건드리지 않는 파일(`14-execution-history.md`·`6-config.md`)의 기존
비대칭으로, 직전 `--impl-prep` 라운드(16_16_35)가 이미 INFO 로 기록해 둔 것을 상태 불변임을 확인하며
캐리포워드했을 뿐이다.

## 위험도

NONE
