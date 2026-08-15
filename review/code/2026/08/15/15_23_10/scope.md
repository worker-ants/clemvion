# 변경 범위(Scope) 리뷰 — eia-db-wire-invariant (누적 diff, origin/main..HEAD, 4번째 라운드)

## 조사 방법

`git log --oneline -10` + `git diff --stat origin/main..HEAD`(79 파일, +5152/-21)로 프롬프트에 실린
파일 목록(파일 1~79)과 전량 대조했다. 이전 세 라운드(`13_58_27`/`14_47_14`/`15_00_41`)의 `scope.md` 가
이미 55개 파일까지 검증해 뒀으므로, 이번 라운드는 **그 이후 새로 생긴 diff**(직전 라운드 자신의 산출물
`review/code/.../15_00_41/**` 11개, `review/consistency/.../15_01_13/**` 7개, 그리고 두 커밋
`bf0f86ca8`/`6f39a7167`가 건드린 실코드 4개 + spec 2개)에 집중해 `git show <sha> -- <path>` 로 각 파일의
실제 diff 를 직접 열어 커밋 메시지·RESOLUTION.md 서술과 1:1 대조했다.

## 발견사항

없음. CRITICAL/WARNING 급 스코프 이탈을 찾지 못했다.

## 확인했으나 문제 없음 (스코프 정합 — 참고용)

- **`bf0f86ca8`**(`14_47_14` W1/W2 조치) — `execution-engine.service.ts` 에 자매 함수 옆 극성
  캐비엇 주석 7줄, `execution-status-response.dto.spec.ts` 의 `it.each` 목록에 `durationMs` 1건
  추가, `CHANGELOG.md` 경로 표기 통일 1줄. 나머지 15개 변경 파일은 전부 `review/code/.../14_47_14/**`
  신규 산출물이다. 커밋 메시지(W1/W2/INFO18)와 실제 diff 가 정확히 일치 — 무관한 수정 없음.
- **`6f39a7167`**(`15_00_41`/`15_01_13` 조치) — `execution-engine.service.ts` 는 재조회를
  try/catch 로 감싸는 것(W1)뿐이고, `.spec.ts` 는 `finishedAt` 되쓰기를 단언하도록 fixture·타입을
  넓힌 것(W2)뿐이다. `plan/in-progress/eia-db-wire-invariant.md`/`update-returning-tuple-shape.md`
  는 체크리스트 갱신 + stale 재분류 각주뿐, `spec/conventions/node-cancellation.md` 는 §2.4 표 1행과
  Rationale 불릿을 실제 동작과 일치하도록 재정정(취소선으로 이전 두 버전 보존)한 것뿐이다. 나머지
  19개 변경 파일은 `review/code/.../15_00_41/**` + `review/consistency/.../15_01_13/**` 신규
  산출물. `git show` 로 직접 열어 대조한 결과 커밋 메시지가 주장하는 범위와 정확히 일치한다.
- **`review/code/2026/08/15/{13_58_27,14_47_14,15_00_41}/**`(33개)와
  `review/consistency/2026/08/15/{13_43_10,15_01_13}/**`(14개)** — developer 가 임의로 작성한
  문서가 아니라, CLAUDE.md 가 명시한 "구현 착수 직전 consistency-check 의무" + "구현 완료 후
  `/ai-review` + Critical/Warning fix 상시 강제 의무" 게이트의 정규 산출물이다. 각 `RESOLUTION.md`
  가 그 라운드의 발견사항과 실제 조치를 1:1 로 서술하고, 이번 검증에서 그 서술과 diff 가 어긋나는
  지점을 찾지 못했다. 세 차례의 선행 `scope.md`(동일 저장소, 동일 파일들)도 같은 결론(NONE)에 도달한
  바 있다 — 이번 라운드에서 그 결론을 뒤집을 근거를 발견하지 못했다.
- `spec/5-system/14-external-interaction-api.md`(§EIA-IN-04 필드 목록·§5.3 응답 예시·§6.5 취소선
  해소 노트)와 `spec/conventions/node-cancellation.md`(§2.4 신규 행 + 이력 보존형 Rationale 정정)는
  전부 plan `eia-db-wire-invariant.md` ①②③ 및 그 후속 리뷰 라운드가 지목한 문서-코드 불일치를 닫는
  편집이며, 원문을 무단 삭제하지 않고 취소선+정정노트로 이력을 누적 보존하는 이 저장소 관행을 그대로
  따른다.
- 포맷팅 전용 변경, 사용하지 않는 임포트, 의도치 않은 설정 파일(`.eslintrc`/`tsconfig`/`package.json`
  등) 변경은 79개 파일 전체에서 발견되지 않았다.

## 요약

`origin/main..HEAD` 79개 파일·5152(+)/21(-) 전량이 plan `eia-db-wire-invariant.md` 의 ①②③ 세 항목,
그 항목들이 거친 4차례의 상시 의무 리뷰(`/ai-review` 13_58_27·14_47_14·15_00_41, `--impl-prep`/
`--impl-done` consistency-check 13_43_10·15_01_13)의 정규 산출물, 그리고 그 리뷰들이 지적한 Critical/
Warning 을 조치한 커밋(`bf0f86ca8`, `6f39a7167`)으로 정확히 설명된다. 이전 세 라운드의 `scope.md` 가
이미 같은 결론(NONE)에 도달했고, 이번 라운드는 그 이후 새로 추가된 diff 를 커밋 단위로 직접 열어
재검증했으나 요청 외 리팩토링·기능 확장(over-engineering)·무관한 파일 수정·포맷팅 뒤섞임·불필요한
주석/임포트 변경·의도치 않은 설정 변경 어느 것도 발견하지 못했다.

## 위험도

NONE
