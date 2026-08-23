STATUS=success convention_compliance review complete — 0 CRITICAL, 0 WARNING, 0 INFO
===REPORT_MARKDOWN_BELOW===
# 정식 규약 준수 검토 — `rerun-dto-shorthand`

## 검토 범위 확인

`--impl-done` payload 상 target 은 `spec/5-system/` 전체 번들이었으나, `origin/main` 대비
실제 diff 를 절대경로 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/rerun-dto-shorthand-730035`)에서
직접 확인한 결과 이번 변경분은 **spec 문서를 전혀 건드리지 않는다**:

```
codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts  |  80 ++
codebase/backend/src/modules/executions/dto/re-run.dto.ts       |   8 +-
plan/complete/rerun-dto-shorthand.md                             |  86 ++
plan/in-progress/spec-sync-external-interaction-api-gaps.md      |  13 +-
review/code/**  (기존 /ai-review 산출물)
```

`plan/complete/rerun-dto-shorthand.md` frontmatter 도 `spec_impact: none` 으로 스스로 신고했고
실제로 `spec/5-system/13-replay-rerun.md`(이 DTO 의 SoT, §8.1) · `spec/5-system/2-api-convention.md` ·
`spec/5-system/3-error-handling.md` 어느 것도 diff 에 없다. 따라서 "target 문서(spec/5-system/)의
정식 규약 위반" 관점에서 볼 신규 산문은 없다 — 본 검토는 (a) target 영역이 실제로 변경되지
않았음을 확인하고, (b) 이번 코드 변경이 target 영역이 참조하는 규약과 상충하지 않는지를
교차 확인하는 것으로 범위를 좁혔다.

## 발견사항

없음.

이번 변경은 `codebase/backend/src/modules/executions/dto/re-run.dto.ts` 의
`inputOverride` 필드 스키마 표기를 축약형 `type: Object` 에서
`type: 'object', additionalProperties: true` 로 바꾼 것이 전부다. 이는
`spec/conventions/swagger.md` §1-4 가 명시한 규정과 **문자 그대로 일치**한다:

> "**열린/동적 map (키 집합이 런타임 결정)** — `@ApiProperty({ type: 'object',
> additionalProperties: true })`." (`spec/conventions/swagger.md:110`)

교차 확인한 항목:

- **명명 규약** — 엔드포인트 `POST /api/executions/:executionId/re-run` 은
  `spec/5-system/2-api-convention.md §2.2` 의 2단계 중첩(`/resource/:id/subresource`) 범위
  안이라 예외 규칙 적용 대상이 아니며 위반도 아니다. 감사 액션 `execution.re_run` 은
  `spec/conventions/audit-actions.md` §2.3(도메인 고유 동사) 레지스트리에 이미 등재된 값과
  일치한다(변경 없음).
- **출력 포맷 규약** — `inputOverride?: Record<string, unknown>` 은
  `spec/5-system/13-replay-rerun.md §8.1` 의 request body 스케치와 동일 타입이며, 에러 코드
  (`INVALID_TRIGGER_PARAMETERS`, `MASKED_VALUE_RESUBMITTED`)도 §8.1 표·
  `spec/5-system/3-error-handling.md §1.3` 카탈로그와 diff 전후 동일하다.
- **API 문서 규약** — 신규 `re-run.dto.spec.ts` 캐너리는 형제 스펙
  `workflows-execute-body.spec.ts` 와 동일하게 `SchemaObject` 를 `ApiResponseSchemaHost['schema']`
  에서 파생하고 `try/finally` 로 `app.close()` 를 보장한다(`/ai-review 20_36_01` W1·W2 가 이미
  지적해 반영됨 — `plan/complete/rerun-dto-shorthand.md` 참조). 규약 위반 재발 없음.
- **금지 항목** — `spec/conventions/swagger.md §1-4` 가 금지하는 "타입 특정이 번거로워서"
  류의 남용이 아니라, `inputOverride` 는 Manual Trigger 파라미터 스키마에 따라 **실제로
  키 집합이 런타임 결정**되는 필드라 열린 map 표기 자체가 정당한 사례다.
- **저장소 전체 검증** — `grep -rn "type: Object" codebase/backend/src --include="*.dto.ts"`
  결과 실제 코드상 잔존 축약형은 0건(유일한 매치는 이번 diff 가 추가한 근거 주석 문자열
  자체)이라, `plan/complete/rerun-dto-shorthand.md` 의 "저장소 전체 축약형 0건" 서술과
  실측이 일치한다.

## 요약

이번 PR 은 `spec/5-system/` 문서를 변경하지 않았고(`spec_impact: none`), 유일한 실질
변경(`re-run.dto.ts` 의 OpenAPI 스키마 표기)은 `spec/conventions/swagger.md §1-4` 가 명시한
"열린/동적 map" 표기 규칙을 정확히 따른다. 관련 spec(`13-replay-rerun.md §8.1`,
`audit-actions.md §2.3`, `2-api-convention.md §2.2`, `3-error-handling.md §1.3`)과도 새로운
불일치가 없다. 정식 규약 준수 관점에서 CRITICAL/WARNING/INFO 어느 등급의 발견사항도 없다.

## 위험도

NONE
