# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[INFO]** `cause` 안전성 판별 기준의 정본화는 여전히 planner 턴 대기 상태 — 신규 결함 아님, 추적 상태만 확인
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md:264` (체크리스트 "`spec/conventions/` 에 판별 기준을 명문화하는 것은 여전히 planner 턴으로 남는다")
  - 상세: `preserve-caught-error` 대응으로 "message 가 이미 원문을 담고 있으면 cause 부착이 안전, `SecretResolverService.resolve` 는 원본을 감추는 자리라 예외" 라는 판별 기준이 지금 `expression-resolver.service.spec.ts`(라인 133-140) · `code.handler.spec.ts`(라인 198-201) · (diff 밖) `secret-resolver.service.ts` 세 곳에 인라인 주석으로만 존재하고 `spec/conventions/` 에는 아직 없다. developer 권한으로는 `spec/` 쓰기가 막혀 있어 이 턴에 정본화할 수 없고, plan 이 그 사실을 명시적으로 남겨 뒀다.
  - 제안: 조치 불요(이미 CLAUDE.md 수렴 예외 (a)~(d) 조건을 갖춰 등재됨). 다음에 이 plan 을 여는 developer/planner 가 체크박스 `[ ]` 상태를 그대로 유지한 채 `spec/conventions/` 명문화를 진행하면 된다.

- **[INFO]** 신규 테스트 뮤테이션 실측치("신규 2건 RED, 기존 131건 GREEN")는 plan 문서에만 기록되어 있고 원 실행 로그 인용이 없음
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md:259`
  - 상세: 문서화 관점에서는 수치 자체의 사실 여부를 검증할 도구가 없다(테스트/뮤테이션 검증은 별도 리뷰어 영역). 다만 이 저장소 관례(`feedback_measured_claim_proxy_and_timing.md` 등)상 실측 수치는 "쓰는 시점의 실제 값"이어야 하므로, 향후 이 PR 이 머지되기 전에 다른 커밋이 두 spec 파일에 케이스를 더 추가하면 "131건"이라는 절대 수치가 stale 해질 수 있다.
  - 제안: 정보성 참고. 수치를 상대적 표현("기존 케이스는 전부 GREEN")으로 남기거나, 리뷰 시점의 커밋 SHA 를 함께 적어 두면 이후 drift 시비를 줄일 수 있다. 이번 라운드에서 강제할 사항은 아님.

## 인라인 주석 품질 (긍정 평가)

- `expression-resolver.service.spec.ts`(게이트 133-140) 와 `code.handler.spec.ts`(게이트 198-201, 216-220) 의 신규 테스트 주석은 예외적으로 우수하다:
  - `preserve-caught-error` 룰 대응이라는 **트리거**, "기존 케이스는 `.message` 만 보므로 `cause` 제거해도 GREEN — 이 케이스가 그 축" 이라는 **vacuity 방지 근거**, "message 가 이미 원본을 담고 있어 cause 가 새 정보를 노출하지 않는다"는 **안전성 판단 근거**, `SecretResolverService.resolve` 와의 **비대칭 처리 이유**를 모두 인라인에 명시했다.
  - `code.handler.spec.ts` 게이트 216-220 은 `toBeInstanceOf(Error)` 를 의도적으로 쓰지 않은 이유(`isolated-vm` 자기 realm 의 `SyntaxError`가 호스트 `Error.prototype` 을 상속하지 않음)를 실측 에러 메시지("Expected constructor: Error / Received constructor: SyntaxError")까지 인용해 남겼다 — 두 형제 테스트의 단언 형태가 다른 이유를 "통일하려다 지우면 안 된다"고 못박아 향후 리팩터링 중 오상 통합을 방지한다.
  - 코드 대조 결과 두 주석 모두 실제 구현(`expression-resolver.service.ts:314-319`, `code.handler.ts:454` 각각의 `cause: err`)과 정확히 일치한다. 오래된 주석/불일치 없음.

## 변경 사항별 요약

- **`codebase/backend/package.json`** — 미사용 `@eslint/eslintrc` devDependency 제거. `import`·`FlatCompat`·`.eslintrc*` 사용처 0건을 grep 으로 재확인했고, plan 문서(§체크리스트 "후속 `@eslint/eslintrc` 죽은 선언 제거")에 근거·부수 확인(`node_modules/@eslint/` 에 `js` 만 남음)까지 기록되어 있어 문서화 수준이 충분하다. `codebase/backend/eslint.config.mjs` 에 `FlatCompat`/`@eslint/eslintrc` 참조가 없음을 확인해 제거가 안전함을 교차 검증했다.
- **`plan/in-progress/deps-peer-gating-and-eslint10.md`** — §3(frozen 게이트 사각지대)의 선행 실측 결과, `@eslint/eslintrc` 제거 근거, `cause` 부착 판단 근거의 처분 변경(주석 → 테스트) 이력을 모두 갖춘 채 갱신됐다. 체크박스 상태(`[x]`/`[ ]`)가 본문 서술과 정확히 대응하며, §3 항목은 아직 (a)/(c) 택일이 남아 있어 의도적으로 `[ ]` 로 유지된 것으로 확인됨(허위 완료 표시 없음).
- **`pnpm-lock.yaml`** — 자동 생성 lockfile. `@eslint/eslintrc` 관련 스냅샷 제거 + jest 관련 peer 해소 변경은 `package.json`/전체 워크스페이스 상태를 그대로 반영한 부수 효과이며, 별도 문서화 대상 아님.
- README/CHANGELOG — 이번 변경은 내부 툴체인(devDependency 정리, 테스트 하드닝)이며 사용자 대면 동작 변경이 없어 `CHANGELOG.md`(Unreleased 섹션은 관례상 제품 동작 변경에 한정) · 루트/`backend` README(둘 다 eslint 언급 없음) 업데이트 불요를 확인했다.

## 요약

이번 변경분(죽은 devDependency 제거, `cause` 보존 회귀 테스트 2건, plan 문서 갱신)은 문서화 품질이 전반적으로 우수하다. 신규 테스트에 붙은 인라인 주석은 트리거·안전성 근거·비대칭 처리 이유·실측 에러 메시지까지 담아 코드와 정확히 일치하며, plan 문서는 선행 실측·체크리스트 상태·미해결 항목(spec/conventions 정본화, §3 (a)/(c) 택일)을 투명하게 추적하고 있다. README/CHANGELOG 갱신 불요 판단도 타당하다. 발견된 두 건은 모두 INFO 로, 신규 결함이 아니라 이미 추적 중인 항목의 상태 확인 또는 향후 drift 가능성에 대한 참고 수준이다.

## 위험도

NONE
