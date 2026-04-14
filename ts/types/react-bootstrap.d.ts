import * as React from 'react';

// Augments react-bootstrap 0.x namespace subcomponents so TS6 resolves them as
// valid JSX element types. Props interfaces are sourced directly from
// @types/react-bootstrap — components that have no dedicated props type fall
// back to React.HTMLProps<any>.
declare module 'react-bootstrap' {
  namespace Panel {
    const Body: React.ComponentType<any>;
    const Footer: React.ComponentType<any>;
    const Header: React.ComponentType<any>; // class is PanelHeading, not PanelHeader
    const Title: React.ComponentType<any>;
    const Collapse: React.ComponentType<any>;
    const Toggle: React.ComponentType<any>;
  }

  namespace Modal {
    const Body: React.ComponentType<any>;
    const Footer: React.ComponentType<any>;
    const Header: React.ComponentType<any>;
    const Title: React.ComponentType<any>;
    const Dialog: React.ComponentType<any>;
  }

  namespace Navbar {
    const Toggle: React.ComponentType<any>;
    // No dedicated props types in @types/react-bootstrap for these:
    const Brand: React.ComponentType<any>;
    const Collapse: React.ComponentType<any>;
    const Form: React.ComponentType<any>;
    const Header: React.ComponentType<any>;
    const Link: React.ComponentType<any>;
    const Text: React.ComponentType<any>;
  }

  namespace Nav {
    const Item: React.ComponentType<any>;
    // No dedicated props type in @types/react-bootstrap:
    const Link: React.ComponentType<any>;
  }

  namespace Media {
    const Body: React.ComponentType<any>;
    const Left: React.ComponentType<any>;
    const Right: React.ComponentType<any>;
    // No dedicated props types in @types/react-bootstrap for these:
    const Heading: React.ComponentType<any>;
    const List: React.ComponentType<any>;
    const ListItem: React.ComponentType<any>;
  }

  namespace Dropdown {
    const Menu: React.ComponentType<any>;
    const Toggle: React.ComponentType<any>;
    const Item: React.ComponentType<any>; // Dropdown.Item is MenuItem at runtime
  }

  namespace Breadcrumb {
    const Item: React.ComponentType<any>;
  }

  namespace Carousel {
    const Caption: React.ComponentType<any>;
    // No dedicated props type in @types/react-bootstrap:
    const Item: React.ComponentType<any>;
  }

  namespace Tab {
    const Container: React.ComponentType<any>;
    const Content: React.ComponentType<any>;
    const Pane: React.ComponentType<any>;
  }

  namespace ListGroup {
    const Item: React.ComponentType<any>;
  }

  namespace InputGroup {
    // No dedicated props types in @types/react-bootstrap for these:
    const Addon: React.ComponentType<any>;
    const Button: React.ComponentType<any>;
  }

  namespace FormControl {
    // No dedicated props type in @types/react-bootstrap:
    const Feedback: React.ComponentType<any>;
  }
}
