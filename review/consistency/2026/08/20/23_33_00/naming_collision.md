STATUS=success naming_collision review complete — 0 CRITICAL, 0 WARNING, 0 INFO
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확정

prompt_file 이 첨부한 bundle 은 `spec/5-system/3-error-handling.md` 전문(2744줄 규모)이었으나,
실제 target 변경분은 `git diff origin/main` 으로 별도 확정했다 — bundle 전문을 새 target 으로
오인하면 기존에 이미 등재돼 있던 `INVALID_INPUT` 등 카탈로그 전체를 "신규 식별자"로 오판할
위험이 있기 때문이다. 실제 diff 는 아래 7개 spec 파일에 걸쳐 있다:

- `spec/1-data-model.md` (Execution.input_data 설명 보강)
- `spec/3-workflow-editor/3-execution.md` (히스토리 로드 서버측 2층 방어 언급 추가)
- `spec/4-nodes/7-trigger/1-manual-trigger.md` (§6 에러 코드 표 + 응답 봉투 문단)
- `spec/5-system/12-webhook.md` (§5.2 details[] 카탈로그 확장)
- `spec/5-system/13-replay-rerun.md` (§8.1 에러 표 + §10.2 캐비엇)
- `spec/5-system/14-external-interaction-api.md` (§R17 소비처 표에 "서버 (재제출 API)" 행 추가)
- `spec/5-system/3-error-handling.md` (§1.3 `INVALID_INPUT` 행 신규 등재, §1.7 카탈로그 확장)

이 diff 가 실제로 새로 도입하는 식별자는 사실상 하나다: `details[].code = MASKED_VALUE_RESUBMITTED`
(및 그 내부 분류 문자열 `masked_value_resubmitted`). 그 외 `INVALID_INPUT` 은 §2 rename-stability
예외로 명시된 대로 **이미 발행 중이던 기존 코드**를 중앙 카탈로그(`3-error-handling.md` §1.3)에
처음 등재한 것뿐이며, endpoint(`POST /executions/:id/re-run`, `POST /workflows/:id/execute`)도
기존에 문서화돼 있던 경로를 재사용한다 — 둘 다 "신규 식별자"가 아니다.

## 점검 관점별 결과

1. **요구사항 ID 충돌** — 새로 부여된 ID 없음. 인용되는 `EIA §R17` 은 diff 이전부터 존재(`git show
   origin/main:spec/5-system/14-external-interaction-api.md` 에서 §R17 앵커 확인). 신규 ID 미도입.
2. **엔티티/타입명 충돌** — 새 엔티티·DTO·인터페이스 도입 없음. `MASKED_VALUE_RESUBMITTED` 는
   에러 응답 `details[].code` 의 열거값이며, 리포지토리 전체(`spec/**`, `codebase/**`)에서
   `MASKED_VALUE_RESUBMITTED`/`masked_value_resubmitted` grep 결과 이 diff 가 도입한 7개
   인용처 외에는 0건 — 기존 사용처와의 값/키 충돌 없음. `RESUBMIT`/`resubmit` 계열의 근접
   명명도 다른 곳에 없어 혼동 후보조차 없음.
3. **API endpoint 충돌** — 새 endpoint 없음. `POST /executions/:id/re-run` 은 [replay-rerun §8.1]
   기존 정의, `POST /workflows/:id/execute` 는 [manual-trigger] 기존 정의를 그대로 재사용.
4. **이벤트/메시지명 충돌** — webhook·queue·SSE 이벤트명 신규 도입 없음.
5. **환경변수·설정키 충돌** — 신규 ENV/config key 없음.
6. **파일 경로 충돌** — 신규 spec 파일 없음(기존 7개 파일 편집만). 새로 생성된 것은
   `plan/in-progress/spec-draft-inputoverride-marker-reject.md` 뿐이며 이는 plan 명명 컨벤션
   범위이고 spec 식별자 충돌 범위 밖이다.

## 부가 확인 — `INVALID_INPUT` 의 §1.7 카탈로그 참조 (충돌 아님, 참고용)

`13-replay-rerun.md`(§8.1)·`3-error-handling.md`(§1.3) 모두 `INVALID_INPUT` 의 `details[].code`
세부값 카탈로그를 "§1.7"(제목상 "Webhook 수신 에러 코드")로 지목한다. 이 참조 패턴은 이 diff 가
새로 만든 것이 아니라 `1-manual-trigger.md` 에 이미 있던 동일 참조("Manual 실행 경로 …도 동일
헬퍼를 쓴다")를 re-run 소비처로 한 곳 더 넓힌 것이다 — 신규 식별자 충돌은 아니고, §1.7 표제가
"webhook" 인데 공유 카탈로그로 쓰이는 기존 명명 관성일 뿐이다(정보용으로만 기록, 등급 부여 안 함
— 명명 충돌이 아니라 섹션 표제-범위 정합성은 cross_spec/convention_compliance 관점).

## 요약

target diff 가 실제로 새로 도입하는 식별자는 `MASKED_VALUE_RESUBMITTED`(및 내부 분류 문자열
`masked_value_resubmitted`) 하나이며, spec 전체와 codebase 전체를 대상으로 grep 한 결과 기존
사용처와 값·키 어느 축에서도 충돌하지 않는다. 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·
환경변수/설정키·spec 파일 경로 그 어느 축에서도 신규 도입 항목이 없거나(엔드포인트·설명 보강은
기존 정의 재사용), 있는 유일한 신규 항목(`MASKED_VALUE_RESUBMITTED`)도 충돌이 없다.

## 위험도

NONE
