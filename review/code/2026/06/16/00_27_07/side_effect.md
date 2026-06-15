### 발견사항

**[INFO] 파일 1 (auth-config-ip-whitelist.dto.spec.ts) — 순수 테스트 파일, 부작용 없음**
- 위치: 새 파일 전체
- 상세: `validate(plainToInstance(...))` 호출은 class-validator 의 메모리 내 검증 로직을 실행하며 외부 상태(파일시스템·네트워크·전역 변수)를 변경하지 않는다. `isIpOrCidr` 순수 함수 테스트도 동일.
- 제안: 없음

---

**[INFO] 파일 3 (is-ip-or-cidr.validator.ts) — class-validator 전역 레지스트리 등록**
- 위치: `@ValidatorConstraint({ name: 'isIpOrCidr', async: false })` 데코레이터 및 `registerDecorator` 호출
- 상세: `@ValidatorConstraint` 데코레이터는 class-validator 내부의 `getMetadataStorage()` 싱글턴에 `IsIpOrCidrConstraint` 를 등록한다. `registerDecorator` 도 동일 스토리지를 변경한다. 이는 **의도된** 부작용이며 class-validator 의 표준 패턴이다. 서버 단위 싱글턴이기 때문에 테스트 격리(describe-별 clean-up 불가)가 필요할 수 있으나, 같은 `name`('isIpOrCidr')으로 중복 등록 시 class-validator 는 후등록을 우선하므로 동일 프로세스 내 이름 충돌만 없으면 안전하다. 이름이 파일 전역에서 유일하므로 충돌 위험 없음.
- 제안: 없음 (표준 패턴)

---

**[WARNING] 파일 2·4 (create-auth-config.dto.ts, update-auth-config.dto.ts) — 기존 DTO 에 새 검증 규칙 추가 → Breaking validation 가능성**
- 위치: `@IsIpOrCidr({ each: true })` 데코레이터 삽입 (`ipWhitelist` 필드)
- 상세: 이전까지 `ipWhitelist` 는 `@IsString({ each: true })` 만 있어 임의 문자열을 허용했다. 이번 변경 이후 단일 IP / CIDR 형식이 아닌 문자열(예: 호스트명, 도메인명, 빈 문자열 아닌 공백 포함 문자열)이 담긴 `ipWhitelist` 를 가진 기존 클라이언트 요청은 `400 Bad Request` 로 거부된다. **기존 저장된 데이터** 자체는 DB 에 그대로 보존되므로 데이터 파괴 부작용은 없으나, 기존 API 호출자가 형식 외 문자열을 전송해 온 경우 이번 배포 이후 요청이 차단된다. API 인터페이스 변경이므로 하위 호환 위험이 있다.
- 제안: (1) 기존 `ipWhitelist` 컬럼에 형식 위반 행이 있는지 마이그레이션/검토가 필요한지 확인. (2) 클라이언트(프론트엔드·외부 통합)가 이미 프론트엔드 레이어에서 동일 형식 검증을 수행하는지 확인 — `authentication/page.tsx` 의 `validateAuthConfigForm` 이 이미 클라이언트 측 검증을 수행하므로 새 서버 검증은 defense-in-depth 로 의도적임. 신규 배포 기준 변경이므로 기존 DB 데이터 레트로핏(backfill)이 필요 없음을 확인하는 것이 좋다.

---

**[INFO] 파일 6 (page.tsx) — `revealMutation.onSuccess` 의 `window.setTimeout` — cleanup 없음**
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/frontend/src/app/(main)/authentication/page.tsx` 라인 1146 `window.setTimeout(() => setRevealedSecret(null), 30_000)`
- 상세: `generatedKey` 의 30초 타이머는 `useEffect` 의 cleanup 함수(`return () => window.clearTimeout(timer)`)로 언마운트 시 정리된다. 반면 `revealMutation.onSuccess` 내부의 `window.setTimeout` 은 mutation 콜백 내에서 직접 등록되며 **cleanup 함수가 없다**. 컴포넌트가 30초 이내에 언마운트되면 이미 unmount 된 컴포넌트에서 `setRevealedSecret(null)` 이 호출된다. React 18 이상에서는 unmount 된 컴포넌트에 setState 를 호출해도 에러는 아니지만, strict 환경에서 warning 을 유발할 수 있다. 또한 stale closure 가 메모리에 남는다. 이 패턴은 이번 PR 에 새로 추가된 것은 아니고 기존 코드이나, 이번 PR 에서 `generatedKey` 경로를 `useEffect` 로 정리하면서 `revealedSecret` 경로와 처리 방식이 **비대칭**이 되었다.
- 제안: `revealedSecret` 의 30초 타이머도 동일하게 `useEffect([revealedSecret])` 패턴으로 리팩토링하면 일관성을 확보하고 누수 위험을 제거할 수 있다. 단, 이는 이번 PR 의 범위를 벗어난 기존 코드이므로 별도 이슈로 추적 가능.

---

**[INFO] 파일 5 (generated-key-autoclear.test.tsx) — `useLocaleStore.setState` 전역 Zustand 스토어 직접 변경**
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-c2-autoclear-isip-1ca382/codebase/frontend/src/app/(main)/authentication/__tests__/generated-key-autoclear.test.tsx` — `beforeEach`/`afterEach` 의 `useLocaleStore.setState({ locale: "en" })`
- 상세: Zustand 스토어를 직접 조작해 테스트 간 locale 을 고정한다. `afterEach` 에서 `setState({ locale: "en" })` 로 원복하므로 테스트 간 오염은 없다. 그러나 Zustand 스토어가 모듈 수준 싱글턴이므로 **병렬 테스트 워커** 환경에서는 같은 worker 내 테스트가 공유 스토어를 변경할 수 있다. vitest 의 기본 단일 worker 격리 모드에서는 문제없다.
- 제안: 없음 (기존 프로젝트 내 테스트 패턴과 일치)

---

**[INFO] 파일 7 (spec/1-data-model.md) — spec 문서 변경, 코드 부작용 없음**
- 상세: `ip_whitelist` 컬럼 설명에 "저장 시 형식 검증, 400 거부" 문구 추가. 순수 문서 변경.

---

**[INFO] 파일 8 (spec/2-navigation/6-config.md) — spec 문서 변경, 코드 부작용 없음**
- 상세: create/regenerate 의 30초 자동 hide 정책을 명시하는 주석 추가. 순수 문서 변경.

---

### 요약

이번 변경의 핵심은 (1) `@IsIpOrCidr` 커스텀 validator 신규 도입, (2) 기존 `CreateAuthConfigDto`·`UpdateAuthConfigDto` 의 `ipWhitelist` 에 해당 검증 추가, (3) `AuthenticationPage` 에서 `generatedKey` 30초 자동 클리어를 `useEffect` + cleanup 으로 구현하는 세 가지다. validator 는 class-validator 전역 메타스토리지에 등록되는 표준 패턴으로 의도된 부작용이며, DTO 에 새 검증 규칙 추가는 기존 형식 외 `ipWhitelist` 를 전송하는 클라이언트를 차단하는 의도적 breaking validation 변경임을 인지해야 한다. 프론트엔드 측에서 동일 형식 검증이 선행되므로 정상 흐름에서 차단되지 않지만, 직접 API 를 호출하는 외부 통합이 있다면 영향을 받는다. 주목할 점은 `revealedSecret` 의 30초 타이머가 `useEffect` 없이 mutation 콜백 내 raw `setTimeout` 으로 남아 있어 `generatedKey` 처리 방식과 비대칭이 되었으나, 이는 기존 코드로 이번 PR 범위는 아니다. 전체적으로 의도하지 않은 부작용은 발견되지 않았다.

### 위험도
LOW
