# Rationale 연속성 Review

검토 대상: `spec/2-navigation/4-integration.md`
검토 모드: `--impl-prep`
검토 시각: 2026-05-16

---

## 발견사항

- **[WARNING]** §11 본문의 "expire 처리" 표현이 폐기된 `expired(refresh_failed)` 경로를 암시
  - target 위치: `spec/2-navigation/4-integration.md` §11 서두 2번째 문단 (line 801)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "refresh 실패 시 status_reason 통일 (2026-05-16)"
  - 상세: Rationale 에서 "refresh 실패 시 `error(auth_failed)` 채택, 옛 `expired (refresh_failed)` 분기 폐기"를 명시했다. 그런데 §11 본문에는 "갱신 실패한 토큰 셋은 그대로 **expire 처리**되어 사용자에게 reauthorize 권장"이라는 문구가 남아 있다. 이 표현은 refresh 실패 시 `expired` 상태로 전이하는 옛 경로를 연상시키며, 현행 동작(`error(auth_failed)` 전이)과 표현이 어긋난다. 구현자가 §11을 읽고 "refresh 실패 → expired" 로 잘못 구현할 여지가 있다.
  - 제안: §11 해당 문구를 "갱신 실패한 토큰 셋은 `error(auth_failed)` 로 전이되어 사용자에게 reauthorize 권장"으로 정정하거나, `expired` 표현을 제거하고 각주로 "refresh 실패의 status 전이는 Rationale 'refresh 실패 시 status_reason 통일' 참조"를 추가한다.

- **[INFO]** target 문서가 orchestrator 에 `(없음)` 으로 전달됨 — 실제 파일은 존재
  - target 위치: prompt_file 의 "Target 문서" 섹션
  - 과거 결정 출처: 해당 없음 (파일 접근 문제)
  - 상세: orchestrator 가 `spec/2-navigation/4-integration.md` 의 내용을 prompt_file 에 포함시키지 못해 "구현 대상 영역: (없음)"으로 기재됐다. 본 검토에서는 해당 파일을 직접 Read 해 분석을 수행했으므로 분석 결과 자체에는 영향 없다. 단, orchestrator 의 target 문서 수집 로직에 버그가 있을 경우 다른 checker 의 검토가 불완전해질 수 있다.
  - 제안: orchestrator 의 파일 수집 단계에서 `(없음)` 반환 여부를 검증하고, 파일이 존재하는데도 `(없음)`이 기재되면 에러를 올리도록 보완한다.

- **[INFO]** `OAuthState.mode='reauthorize'` Rationale 의 "향후 분리 검토" 언급과 현재 `request_scopes` 분리 상태 간 정합 보완 필요
  - target 위치: `spec/2-navigation/4-integration.md` Rationale "OAuthState.mode='reauthorize' 를 초기 install 에도 재사용한 이유"
  - 과거 결정 출처: 동일 Rationale 항목 (2026-05-14)
  - 상세: 2026-05-14 Rationale 에서 "향후 reauthorize 와 분리해야 할 동작이 늘어나면 별도 mode 신설 검토"라고 남겼다. 이후 Rationale "Cafe24 Private request-scopes 흐름 (2026-05-15)"에서 `request_scopes` mode 는 Private 에서 `begin` 우회 분기를 별도 처리하도록 분리됐다. `mode='reauthorize'` 와 `mode='request_scopes'` 의 분리 유지 결정이 명시됐으나, 원래 Rationale 의 "향후 검토" 언급은 아직 갱신되지 않아 독자가 "아직 미결 사항"으로 오해할 수 있다.
  - 제안: Rationale "OAuthState.mode='reauthorize'" 항에 "(2026-05-15 후속) `request_scopes` mode 와의 분리는 'Cafe24 Private request-scopes 흐름' 항 참조 — 분리 방향으로 처리됨" 한 줄을 추가한다.

---

## 요약

`spec/2-navigation/4-integration.md` 는 다수의 Rationale 항목이 풍부하게 작성되어 있으며, 기각된 대안(옛 mall_id 스캔 방식, install timeout 자동 삭제, expired(refresh_failed) 분기 등)의 번복 근거가 해당 Rationale 에 명시되어 있다. 전체적으로 Rationale 연속성이 잘 유지되고 있다. 다만 §11 본문에 "expire 처리"라는 표현이 폐기된 `expired(refresh_failed)` 흐름을 연상시키는 채로 남아 있어 구현자 혼란의 여지가 있다(WARNING 1건). 나머지는 문서 교차 참조 명확화 또는 orchestrator 개선에 관한 INFO 수준 보완 사항이다. 현행 target 문서가 과거 합의 원칙을 직접 위반하거나 기각된 대안을 재도입하는 CRITICAL 수준의 문제는 발견되지 않았다.

---

## 위험도

LOW
