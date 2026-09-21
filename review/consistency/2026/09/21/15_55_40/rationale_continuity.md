# Rationale 연속성 검토 — `authconfig-dup-delete` (spec/2-navigation)

## 검토 범위 정정 (전제 확인)

전달된 target 번들의 `## 구현 변경 사항` 섹션(및 `spec/2-navigation/6-config.md` 본문)은 프롬프트
예산 절단으로 실제로는 비어 있었다(헤더만 있고 diff 본문 없음). 이는 "구현 없음"이 아니라
"잘림"이므로, 프롬프트 지시대로 워킹트리를 절대경로로 직접 확인했다:

- `git -C ".../authconfig-dup-delete-7e3a1c" diff origin/main --stat` → 실제 코드 변경은
  `codebase/backend/src/modules/auth-configs/auth-configs.service.ts`(+`*.service.spec.ts`,
  신규 `auth-config-delete-concurrency.e2e-spec.ts`) 뿐이다. `spec/2-navigation/**` 델타는
  실측으로도 0개 파일 — 프롬프트가 밝힌 "scope 델타 0"과 일치하며 정상이다.
- `plan/in-progress/authconfig-dup-delete.md`, `CHANGELOG.md`(Unreleased 최상단 항목),
  `review/code/2026/09/21/15_18_16/` · `15_45_04/`(이미 완료된 `/ai-review` 2라운드,
  Critical/Warning 0)를 근거로 삼았다.

## 배경 — 이 변경이 속한 계열

이 PR은 "동시 DELETE 두 건이 감사 행을 두 번 남긴다"는 결함 클래스의 **일곱 번째 자리**
(`AuthConfigsService.remove()`)를 닫는다. 선행 여섯 자리: 워크플로·워크스페이스(#1369),
트리거(#1370), 스케줄(#1371), 통합(#1372), 멤버 제거(#1373). 각 자리는 그 결함을 고치며 사용한
동시성 전략(advisory lock 유무)에 대한 근거를 남겼고, 이번 PR은 그 이력을 코드 주석·
`plan/in-progress/authconfig-dup-delete.md`·`CHANGELOG.md`에서 명시적으로 재확인하며 진행했다.

## 발견사항

없음. 아래는 확인 과정에서 대조한 잠재 충돌 지점과 그 결과다 — 전부 정합.

1. **`4-integration.md` 가 기각한 advisory lock 재도입 여부** — `spec/2-navigation/4-integration.md`
   (L1494)는 토큰 갱신 컨텍스트에서 advisory lock 을 "lock 보유 중 외부 HTTP 요청(Cafe24 endpoint)
   으로 DB 커넥션 점유 시간 증가"를 이유로 명시적으로 기각했다. 이번 diff는 advisory lock 을
   **도입하지 않고** (`잠글 것이 없다` 는 이유로) 원자적 `DELETE`+`affected` 판정만 쓴다 — 기각된
   대안을 재도입하는 것이 아니라, #1372(통합)·#1373(멤버)가 이미 확립한 "락 불필요 자리는 원자적
   DELETE" 패턴을 그대로 잇는다. 충돌 없음.
2. **`3-error-handling.md` §1.11 invariant** — 이 저장소에서 `*_NOT_FOUND` 이름을 가진 코드는
   `triggers.service.ts` 의 `AUTH_CONFIG_NOT_FOUND`(400, 트리거→AuthConfig 참조 검증 실패) 단
   하나만 404 가 아니라는 명시적 invariant다. 신규 `throwAuthConfigNotFound()` 헬퍼는 기존
   `RESOURCE_NOT_FOUND`(404)를 재사용하며, JSDoc 으로 "이름이 가깝지만 다른 자리"임을 §1.11을
   인용해 명시했다 — invariant 를 우회하지 않고 오히려 그 존재를 근거로 헬퍼명 충돌을 방지했다.
3. **`redis-keys.md` §4 advisory lock 키 인벤토리** — `trigger-config:<id>`·`exec-cap:<id>` 두
   키만 등재돼 있다. 이번 diff 는 신규 advisory lock 키를 만들지 않으므로 이 인벤토리와 어긋나지
   않는다(등재 대상 자체가 발생하지 않음).
4. **`remove(entity)` → `delete(criteria)` 전환(결정 번복 여부)** — 동작을 바꾸는 결정처럼
   보이지만, `AuthConfig` 엔티티에 `cascade`/`@OneToMany`/ORM lifecycle hook 이 없음을 실측으로
   확인하고 CHANGELOG·plan·코드 주석 세 곳에 동일 근거를 남겼다. 이는 "무근거 번복"이 아니라
   #1369~#1373 다섯 자리가 동일하게 거친 절차이며, spec 자체의 API 계약(DELETE 응답 코드·204·
   FK `ON DELETE SET NULL`)은 변경되지 않아 `spec_impact: none`이 정합하다.
5. **패자 요청의 감사 생략** — `affected === 0` 이면 감사를 건너뛰는 것이 "실패해도 감사를 남긴다"는
   원칙과 충돌하는지 확인했으나, `spec/data-flow/1-audit.md` Rationale 에는 그런 invariant가
   없고, 오히려 이 처리(패자=404, 감사 생략)가 형제 다섯 자리 전체(#1369~#1373)의 확립된 표준
   동작이다.

## 요약

이번 diff(`AuthConfigsService.remove()` 동시 삭제 이중 감사 수정)는 spec/2-navigation 문서 자체를
건드리지 않으며(spec 델타 0, `spec_impact: none` 정합), 코드 레벨에서도 기존에 확립된 Rationale·
invariant — `4-integration.md`가 기각한 advisory lock 대안의 비도입, `3-error-handling.md` §1.11의
`_NOT_FOUND`≠404 예외 자리 보존, `redis-keys.md`의 advisory lock 키 인벤토리 불변, 형제 PR
#1369~#1373이 세운 "락 없는 자리는 원자적 DELETE" 패턴 — 을 코드 주석·CHANGELOG·plan에 명시적으로
근거를 남기며 그대로 계승한다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, 암묵적 invariant
우회 중 어느 것도 발견되지 않았다.

## 위험도

NONE
