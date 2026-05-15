### 발견사항

- **[INFO]** `@nestjs/schedule ^6.1.3` — 단일 일일 배치 작업을 위해 추가됨
  - 위치: `backend/package.json`
  - 상세: `login-history-pruner.service.ts`의 `@Cron(CronExpression.EVERY_DAY_AT_3AM)` 하나를 위해 `ScheduleModule.forRoot()`가 전역 등록됨. 기능 범위 대비 비용은 작음.
  - 제안: 수용 가능. NestJS 공식 패키지이며 이후 다른 스케줄러 요건이 생길 경우 재사용 가능.

- **[INFO]** `luxon ~3.7.0` — `cron 4.4.0`의 런타임 전이 의존성
  - 위치: `backend/package-lock.json` → `node_modules/cron`
  - 상세: cron 표현식 파싱·실행을 위해 luxon(~70 KB minified) 이 런타임에 포함됨. 백엔드 번들이므로 클라이언트 영향 없음.
  - 제안: 수용 가능. 백엔드 Node 프로세스 기동 시간에 미미한 영향만 있음.

- **[INFO]** `@types/luxon 3.7.1` — devDependency가 아닌 cron의 일반 의존성으로 포함
  - 위치: `backend/package-lock.json` → `node_modules/@types/luxon`
  - 상세: `cron` 패키지가 `@types/luxon`을 `dependencies`로 선언(일반적으로 type 패키지는 devDependency에 두는 관례에서 벗어남). cron 측 패키지 설계 문제이며 런타임 동작에는 영향 없음.
  - 제안: 조치 불필요. 업스트림 이슈.

- **[WARNING]** `@nestjs/schedule` 피어 의존성 충족 여부 확인
  - 위치: `backend/package-lock.json` — `peerDependencies: { "@nestjs/common": "^10.0.0 || ^11.0.0" }`
  - 상세: 현재 프로젝트는 NestJS v11 계열(`@nestjs/common ^11.x`)을 사용하므로 피어 요건 충족. 단, `^6.1.3` 캐럿 범위는 minor 버전 자동 업그레이드를 허용하므로, `6.x` 내 breaking change 발생 시 잠재적 위험.
  - 제안: 수용 가능. NestJS 공식 패키지는 semver를 잘 지키는 편이며, `^`는 NestJS 생태계 표준.

- **[INFO]** `cron 4.4.0` Node 최소 요건 (`>=18.x`)
  - 위치: `backend/package-lock.json` → `engines: { node: ">=18.x" }`
  - 상세: NestJS v11 자체가 Node 18+를 요구하므로 기존 요건과 일치.
  - 제안: 이미 충족됨.

- **[INFO]** 내부 의존성 구조 — 정상
  - `LoginHistory` 엔티티: `AuthModule.TypeOrmModule.forFeature`와 `app.module.ts ROOT_ENTITIES` 양쪽에 모두 등록됨 ✓
  - `LoginHistoryService`가 `AuthModule.exports`에 포함되어 필요 시 외부 모듈에서 사용 가능 ✓
  - `ScheduleModule.forRoot()`가 `app.module.ts`에 전역 등록되어 `@Cron` 데코레이터 인식 ✓
  - `SessionsController`를 `AuthModule`에 둔 점은 `RefreshToken` 리포지토리 의존성을 고려한 합리적 결정 ✓

---

### 요약

이번 변경에서 외부 의존성 추가는 `@nestjs/schedule ^6.1.3` 하나뿐이며, 이에 따라 `cron 4.4.0`·`luxon ~3.7.0`·`@types/luxon 3.7.1`이 전이 의존성으로 유입된다. 세 패키지 모두 MIT 라이선스로 프로젝트와 호환되며, 기존 NestJS v11·Node 18+ 환경과의 피어/엔진 요건도 충족한다. 라이선스·보안 취약점·버전 충돌 관점에서 별도 조치가 필요한 사안은 없고, 내부 모듈 의존성도 엔티티 등록·모듈 익스포트·ScheduleModule 전역 등록 모두 올바르게 연결되어 있다.

### 위험도

**LOW**