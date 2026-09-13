# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[INFO]** `spec/conventions/user-guide-evidence.md §2` 가 여전히 "가드 3건" 으로 세고 있어 이번 리네임(`guide-error-code-existence` → `guide-identifier-existence`) 반영 후에도 SoT 쪽 개수·관계표가 코드와 어긋난다.
  - 위치: `PROJECT.md:300` (SoT 참조 `spec/conventions/user-guide-evidence.md §2`), `CHANGELOG.md:66-67`(가드 가족 언급)
  - 상세: 이 drift 는 이번 PR 이 새로 만든 것이 아니라 `#1330` 시점부터 있던 선재 결함이다. `developer` 는 `spec/` 쓰기 권한이 없고, `plan/in-progress/guide-identifier-existence.md` §D(지적 #1·#2)와 `plan/in-progress/spec-draft-nullable-notation-followups.md`(§2/§2.1 갱신 항목)에 이미 planner 몫으로 등재돼 있으며 plan 본문 자체가 "통산 8회 확인"이라 적고 있다. 재-flag 는 오탐에 가깝지만, 문서화 관점의 완전성을 위해 기록만 남긴다.
  - 제안: 조치 불요 — 기존 planner 등재 항목으로 계속 추적.

- **[INFO]** 이전 라운드에서 지적된 문서화 결함(“지우지 말 것” 주석 삭제, `guide-sanitized-message-parity.test.ts` 의 옛 파일명 교차참조, `MCP_ALLOW_INSECURE_URL` 표기 오기, `run-test-all.sh` 회귀 단언 소실 등)이 현재 파일 상태 기준으로 모두 복원·정정되어 있음을 직접 열어 확인했다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:53-76`(한계 절 복원 + 재발 경위), `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts:16-17`(신 파일명 + 구 파일명 병기)
  - 상세: `guide-identifier-scan.ts` 상단에 설계 배경·축 결정 근거·정규식 경계 전수 감사표·"이 주석을 지우지 말 것" 경고와 그 경고가 실제로 한 번 지워졌다가 리뷰로 복구된 경위까지 메타 기록으로 남아 있다. `CHANGELOG.md:69-81`·`PROJECT.md:300` 은 리네임된 파일명·3축·허용목록 4강제 내용을 코드와 일치하게 서술한다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 옛 파일명 참조 7곳은 전부 "리네임 전 이름(각주)" 형태로 갱신되어 있어 참조 무결성이 유지된다.
  - 제안: 없음(양성 확인).

## 요약

이번 diff 는 `guide-error-code-existence`(에러 코드 전용, 허용목록 없음) 가드를 `guide-identifier-existence`(에러 코드+환경변수, 4강제 허용목록)로 리네임·확장하면서, 코드 내 JSDoc/모듈 주석(설계 배경, 판정 축, 정규식 경계, 알려진 한계, 이전 라운드의 실수와 복구 경위)을 이례적으로 상세하게 갖췄고, `CHANGELOG.md`·`PROJECT.md`·`plan/in-progress/*.md` 세 문서가 파일명·축 구성·허용목록 강제 항목 수까지 코드와 정확히 일치한다. 5라운드에 걸친 `/ai-review`+`--impl-done` 반복 검증에서 발견된 문서화 결함(주석 삭제, 교차참조 stale, 회귀 단언 소실)은 모두 현재 파일 상태에서 직접 확인한 결과 정정되어 있다. 유일하게 남은 항목은 `spec/conventions/user-guide-evidence.md §2` 의 가드 개수 drift 인데, 이는 developer 권한 밖(`spec/` 쓰기 불가)이며 이미 planner 백로그에 반복 등재된 선재 이슈라 이번 PR 의 신규 결함으로 볼 수 없다.

## 위험도

NONE
