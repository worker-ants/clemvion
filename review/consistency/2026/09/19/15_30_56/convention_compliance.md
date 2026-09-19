# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-integration-db-test-waits.md`

## 발견사항

- **[INFO]** 인용 형식은 이미 규약을 초과 충족 — 특기할 위반 없음
  - target 위치: `## 왜` §1·§2 — `review/code/2026/09/19/15_02_57` WARNING 4 · `review/consistency/2026/09/19/13_21_00` INFO 1
  - 위반 규약: 해당 없음 (`spec/conventions/review-citations.md` §3)
  - 상세: `review-citations.md` §3 표는 `plan/**` 문서를 인용 규약 적용 대상에서 명시적으로 제외한다 ("인용하는 라운드와 같은 세션에서 쓰이고, 문서 자체가 그 맥락을 담는다"). 따라서 이 draft 의 인용은 규약 적용 대상이 아니며, 설령 대상이었더라도 "전체 경로 + 날짜 + 지적 번호" 형태(§2 "권장" 등급)라 이미 최고 등급을 충족한다.
  - 제안: 조치 불필요. (문서 갱신도 불요 — 이미 대상 외.)

- **[INFO]** 대상 spec 파일 인용 사실관계·범위가 실측과 일치 (규약 위반 아님, 검증 결과 기록)
  - target 위치: `## 변경` A·B, `## 왜` §1·§2
  - 위반 규약: 해당 없음
  - 상세: `spec/2-navigation/4-integration.md` 를 직접 열어 대조한 결과 — (1) §5.4 원문이 정확히 "연결 대기는 10초." 로 끝난다(line 497 부근), (2) §6 `pending_install` 설명 괄호가 정확히 "— §9.3." 으로 되어 있다(line 742), (3) `POST /api/integrations/:id/test` 행과 `pending_install`/`INTEGRATION_INCOMPLETE` 가드 서술은 실제로 §9.1 표(line 817 부근)에 있고 §9.3(line 834~)은 "사용처·활동"이라 draft 의 정정이 맞다. `grep -rn "9\.3"` 으로 저장소 전체를 훑어도 같은 클레임을 가리키는 §9.3 참조는 이 한 곳뿐이라, draft 가 놓친 병렬 스테일 참조도 없다.
  - 제안: 조치 불필요 — 실측 검증 통과.

- **[INFO]** `INTEGRATION_INCOMPLETE` 명명이 이미 정식 등재된 예시와 일치
  - target 위치: `## 변경` B, `## 왜` §2
  - 위반 규약: 해당 없음 (`spec/conventions/error-codes.md` §1)
  - 상세: draft 가 참조만 하고 새로 도입하지 않는 `INTEGRATION_INCOMPLETE` 코드는 `error-codes.md` §1 "의미 기반 명명" 절에 이미 준수 예시(`INTEGRATION_INCOMPLETE`(통합 미완성))로 등재돼 있다 — `UPPER_SNAKE_CASE`, 도메인 prefix 규칙 모두 부합. draft 는 이 코드의 명명·의미를 바꾸지 않고 절 번호 참조만 정정하므로 §2 "rename 은 breaking" 정책과도 무관하다.
  - 제안: 조치 불필요.

이 draft 범위(§5.4 문장 1건 교체, §6 괄호 안 절 번호 1건 교체) 안에서는 새 식별자·새 API endpoint·새 에러 코드·새 출력 포맷·새 문서 구조를 전혀 도입하지 않으며, `spec/conventions/**` 가 규정하는 명명·출력 포맷·문서 구조·API 문서·금지 항목 다섯 관점 중 어느 것도 위반하지 않는다. `## Rationale` 섹션(레벨-2 `## Rationale`)의 사용 형태도 이 저장소의 conventions 문서들(예: `error-codes.md`, `review-citations.md`, `spec-impl-evidence.md`)이 쓰는 관례와 일치한다.

## 요약

target draft 는 이미 구현·머지된 동작(연결+쿼리 각 10초 타임아웃)과 이미 존재하는 절 번호 오류를 spec 문서에 사실대로 반영하는 순수 정정이며, 새로운 명명·출력 포맷·문서 구조·API 데코레이터 패턴을 전혀 도입하지 않는다. 두 정정 대상 문장을 실제 `spec/2-navigation/4-integration.md` 와 직접 대조한 결과 인용된 원문·수정 위치·근거 절 번호(§9.1)가 모두 정확했고, 참조하는 `INTEGRATION_INCOMPLETE` 에러 코드도 `spec/conventions/error-codes.md` 의 기존 명명 규약과 일치한다. 리뷰 인용 형식도 `review-citations.md` 기준을 (적용 대상이 아님에도) 초과 충족한다. `spec/conventions/**` 위반 사항은 발견되지 않았다.

## 위험도

NONE
