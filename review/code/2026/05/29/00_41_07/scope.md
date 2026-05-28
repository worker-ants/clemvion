# 변경 범위(Scope) 리뷰

## 리뷰 대상 커밋

`840db52d` — fix(external-interaction): terminal jti revoke 를 notification config 게이트 위로 hoist

## 발견사항

### notification-fanout.service.ts

- **[INFO]** 핵심 버그 픽스 — revoke 호출 위치 hoist
  - 위치: `handle()` 메서드, `triggerId` 검증 직후 블록 (파일 전체 기준 line 900–912)
  - 상세: `revokeAllForExecution` 호출을 `trigger.config.notification` 게이트 이전으로 이동. 변경 의도(EIA-AU-04 미충족 수정)에 정확히 부합하는 단일 로직 이동이다.
  - 제안: 없음.

- **[INFO]** 클래스 독스트링 갱신 (line 841–851)
  - 위치: 클래스 JSDoc 주석
  - 상세: 항목 1·2 순서가 뒤바뀌었고, "향후 jti 추적 인프라 도입 시 사용" 문구가 "terminal event 시 iext jti 즉시 blacklist" 문구로 교체되었다. 구현 변경을 정확히 반영하는 주석 갱신이다. 의도에 부합한다.
  - 제안: 없음.

- **[INFO]** 생성자 인라인 주석 갱신 (line 862)
  - 위치: `tokenService` 파라미터 주석
  - 상세: "향후 jti 추적 인프라 도입 시 사용. 현재는 fail-open." → "terminal event 시 iext jti 즉시 blacklist (EIA-AU-04). Redis/Repo 미가용 시 fail-open." 으로 교체. 구현 현실을 정확히 기술한다. 범위 내 갱신이다.
  - 제안: 없음.

- **[INFO]** 제거된 이전 revoke 블록 (구 line 119–131 영역)
  - 위치: `dispatcher.enqueue()` 호출 이후
  - 상세: 이전 위치의 `if (TERMINAL_EVENTS…) { try { revokeAllForExecution… } }` 블록 삭제. 로직 이동의 결과이며 코드 중복이 생기지 않는다. 변경 의도와 완전히 일치한다.
  - 제안: 없음.

### notification-fanout.service.spec.ts (신규 파일)

- **[INFO]** 테스트 파일 신규 작성
  - 위치: 전체 파일 (156 라인)
  - 상세: 커밋 메시지에 명시된 "NotificationFanout 단위 테스트 신설 (기존 0건) — 8 케이스"에 해당. `terminal × notification 유무 × trigger 발견/미발견 × fail-open` 조합을 모두 커버한다. 변경 의도의 명시적 범위 안에 있다.
  - 제안: 없음.

### interaction.guard.spec.ts

- **[INFO]** 단일 테스트 케이스 추가 (line 56–74 diff 기준)
  - 위치: `describe('InteractionGuard')` 블록 내부
  - 상세: `blacklisted` reason → `TOKEN_REVOKED 401` 매핑 + `REFRESH_TOKEN_URL_HEADER` 동봉을 검증하는 1개 케이스 추가. 커밋 메시지에서 명시적으로 언급된 "InteractionGuard 단위 테스트 추가" 범위에 부합한다.
  - 제안: 없음.

- **[INFO]** 기존 테스트 코드 무수정 확인
  - 위치: 파일 전체
  - 상세: diff 에서 변경된 부분은 새 테스트 블록 삽입뿐이며, 기존 테스트 케이스·헬퍼 함수(`makeContext`, `makeGuard`)에 수정이 없다. 범위 이탈 없음.
  - 제안: 없음.

## 요약

이번 변경은 `notification-fanout.service.ts` 의 `revokeAllForExecution` 호출 위치를 `notification` 게이트 이전으로 hoist 하는 단일 버그 픽스와, 그 픽스를 결정적으로 검증하는 단위 테스트(신규 spec 파일 1개 + 기존 guard spec 케이스 1개 추가)로 구성된다. 의도와 무관한 파일·코드 영역의 수정, 불필요한 리팩토링, 의미 없는 포맷팅 변경, 관련 없는 임포트·설정 변경은 발견되지 않았다. 주석 변경은 모두 구현 현실을 반영하기 위한 필수적 갱신이며 범위를 벗어나지 않는다.

## 위험도

NONE
