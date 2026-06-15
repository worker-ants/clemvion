# Requirement Review — config-c2-autoclear-isip-1ca382

## 발견사항

### [INFO] IsIpOrCidrConstraint 는 stateless — 의존성 주입 필요 없음, 정상
- 위치: `is-ip-or-cidr.validator.ts` 전체
- 상세: `IsIpOrCidrConstraint` 가 `@ValidatorConstraint({ async: false })` 로 등록되고 `registerDecorator` 에서 `validator: IsIpOrCidrConstraint` 클래스 참조를 그대로 사용한다. 본 constraint 는 DI 를 사용하지 않으므로 NestJS `useContainer` 없이도 class-validator 가 자체 인스턴스를 생성할 수 있다 — 정상 패턴이다.

### [INFO] `@IsIpOrCidr` + `@IsString({ each: true })` 중복 어노테이션 순서 — 동작상 무해
- 위치: `create-auth-config.dto.ts:383-386`, `update-auth-config.dto.ts:59-63`
- 상세: `@IsString({ each: true })` 와 `@IsIpOrCidr({ each: true })` 가 함께 선언되어 있다. 비-문자열이 들어오면 `@IsString` 이 먼저 실패해 두 에러가 모두 반환되지만, `isIpOrCidr()` 자체도 비-문자열 → `false` 를 반환하므로 동작에 버그는 없다. 두 제약을 중첩하면 에러 메시지가 2개 생성되는 경우가 있으나 400 거부 자체는 올바르다.
- 제안: 현행 유지 가능. 원한다면 `@IsIpOrCidr` 내부에서 `typeof value !== 'string'` 분기를 이미 처리하므로 `@IsString` 을 제거해 중복 에러 방지 가능하나, 필수는 아님.

### [INFO] `null` 배열 항목 케이스 테스트 없음
- 위치: `auth-config-ip-whitelist.dto.spec.ts`
- 상세: `['10.0.0.1', null]` 처럼 배열 내 `null` 항목이 들어오는 케이스의 테스트가 없다. `@IsString({ each: true })` 가 null 을 잡아주므로 동작상 문제는 없으나, `isIpOrCidr(null) === false` 는 별도 비-문자열 테스트(`it.each([null, undefined, ...])`)로 확인되어 있어 기능상 공백은 없다.

### [INFO] `generatedKey` autoclear 는 regenerate 에도 동일 `setGeneratedKey` 경로 사용 — spec 일치
- 위치: `page.tsx:253-261` (`regenerateMutation.onSuccess`)
- 상세: `regenerateMutation.onSuccess` 에서 `setGeneratedKey(secret)` 를 호출하므로, `generatedKey` useEffect 의 30초 타이머가 regenerate 흐름에도 자동 적용된다. spec §A.4 주석("create / regenerate 의 1회 노출에도 동일 적용")과 일치한다.

### [INFO] `spec/2-navigation/6-config.md §A.4` — 언마운트 타이머 정리 요건이 spec 본문에 명시됨, 코드가 이를 충족
- 위치: `page.tsx:160-175`
- 상세: spec 122행: "생성·재생성 직후 표시된 평문 키도 **30초 후 자동으로 비워**(언마운트 시 타이머 정리) 화면 방치 시 노출 시간을 제한한다." — 코드의 `useEffect` cleanup `() => window.clearTimeout(timer)` 가 이 요건을 정확히 충족한다. 기존 구현(`window.setTimeout(() => setRevealedSecret(null), 30_000)` 직접 호출, 언마운트 cleanup 없음)이 이 요건을 위반하고 있었으며, 본 변경이 이를 수정한다.

### [INFO] `spec/1-data-model.md §2.17` — ip_whitelist 저장 시 형식 검증 요건, 코드가 이를 충족
- 위치: `create-auth-config.dto.ts:385`, `update-auth-config.dto.ts:60`
- 상세: spec §2.17 (data-model.md 610행): "**저장(create/update) 시 각 항목을 형식 검증**하며 단일 IP/CIDR(IPv4·IPv6) 가 아니면 `400` 으로 거부한다." — `@IsIpOrCidr({ each: true })` 추가가 이 요건을 정확히 충족한다. `CustomValidationPipe` 가 검증 실패 시 `BadRequestException`(HTTP 400)을 던지므로 에러 코드 요건도 충족된다. 한편, spec §2.17 에 반영된 본 문구는 본 PR 에서 함께 추가된 것(spec/1-data-model.md diff)으로, 코드-spec 정합이 이 PR 안에서 함께 완성됨.

### [WARNING] `revealedSecret` useEffect 의존배열: 값이 `null` → 평문 순환 시 타이머 과잉 실행 가능
- 위치: `page.tsx:169-175`
- 상세: `useEffect(() => { if (!revealedSecret) return; ...setTimeout... }, [revealedSecret])` 패턴에서, `setRevealedSecret(null)` 로 타이머가 클리어된 뒤 다시 `revealMutation.onSuccess` 가 호출되면 새 타이머가 정상 생성된다. 그런데 사용자가 "닫기(X) 버튼" → `setRevealedSecret(null)` → 재-reveal 흐름을 빠르게 반복할 경우 각 reveal 마다 새 useEffect 실행 + 새 타이머 등록 + 이전 타이머 cleanup 이 발생한다. 이 로직은 설계상 의도적이며 cleanup 이 항상 실행되므로 타이머 누수는 없다. 다만 두 reveal 사이 간격이 매우 짧으면 이전 타이머가 cleanup 되기 전에 새 타이머가 설정된 것처럼 동작할 수 있다 — 실제로는 cleanup 이 effect 재실행 전에 항상 실행되므로 문제없음. **경고 등급**: 동작 버그 없음, 유지보수 목적 명료성 차원.
- 제안: 현행 구현은 안전하다. 선택적으로 `generatedKey` 와 동일 패턴이므로 일관성은 충족됨.

### [WARNING] 테스트에서 `AUTOCLEAR_MS` 상수를 하드코딩 — page.tsx 상수 변경 시 테스트가 자동으로 실패하지 않음
- 위치: `generated-key-autoclear.test.tsx:14`
- 상세: `const AUTOCLEAR_MS = 30_000;` 를 테스트 파일에 하드코딩하고 주석으로 "page.tsx 의 `SECRET_AUTOCLEAR_MS` 와 동일해야 한다"고 명시하나, 실제로 `SECRET_AUTOCLEAR_MS` 를 export 해 import 하지 않는다. page.tsx 에서 상수값이 변경되면 테스트가 계속 통과하는 false-negative 가 발생한다.
- 제안: `SECRET_AUTOCLEAR_MS` 를 `page.tsx` 에서 `export const` 로 변경하거나, 별도 상수 모듈로 분리해 테스트에서 직접 import 하는 것을 권장한다.

### [INFO] `spec/2-navigation/6-config.md §A.4` 에 "언마운트 cleanup" 요건이 명시되어 있으나 WH-SC-09 는 저장 시점 검증 언급 없음
- 위치: `is-ip-or-cidr.validator.ts` jsdoc 주석
- 상세: validator 주석이 `spec/5-system/12-webhook.md WH-SC-09` 를 참조하나, WH-SC-09 는 런타임 ip_whitelist 평가 요건을 정의한 항목이며 DTO 저장 검증을 명시적으로 정의하지 않는다. 저장 검증 요건의 직접적 SoT 는 `spec/1-data-model.md §2.17` 이다. WH-SC-09 참조는 "런타임 평가와 동일한 수용 기준"을 설명하는 맥락으로 적절하지만, 주석이 WH-SC-09 를 요건 출처로 오해하게 할 수 있다. 동작 버그 없음.

---

## 요약

본 변경은 두 독립적인 요건을 충족한다. (1) 백엔드: `ip_whitelist` 저장 시 IP/CIDR 형식 검증(`@IsIpOrCidr`) — spec/1-data-model.md §2.17 에 "저장 시 400 거부" 요건과 완전히 일치하며, `parseIp` 런타임 판정과 동일한 `Address4.isValid || Address6.isValid` 기준을 사용해 저장-런타임 drift 가 없다. `CustomValidationPipe` 가 HTTP 400 을 정확히 반환한다. (2) 프론트엔드: `generatedKey` / `revealedSecret` 평문 30초 자동 클리어를 `useEffect` + cleanup 패턴으로 리팩터링 — spec/2-navigation/6-config.md §A.4 의 "언마운트 시 타이머 정리" 요건을 충족하고, 기존 `setTimeout` 직접 호출의 cleanup 누락을 수정한다. 엣지 케이스(빈 배열, optional 미지정, 비-문자열, CIDR 범위 초과, IPv6, 공백 포함 등)가 테스트로 커버된다. 주요 미결 위험: 테스트 내 `AUTOCLEAR_MS` 하드코딩이 유지보수 trap 이 될 수 있으나 즉각적인 기능 버그는 없다.

---

## 위험도

LOW
